import path from 'node:path';
import fs from 'node:fs';
import type { DerivedAsset, VoiceRosterEntry } from '../src/types/media.ts';
import { loadCaseBundle, saveCaseBundle, getCaseDir } from './lib/caseFiles.ts';
import { parseArgs } from './lib/cli.ts';
import {
  createVoiceCloneDraft,
  createVoiceFromDesign,
  designVoice,
  synthesizeSpeech,
} from './lib/elevenlabs.ts';
import { loadLocalEnv, requireEnv } from './lib/env.ts';
import { ensureDir, writeBinaryFile, writeTextFile } from './lib/fs.ts';
import { createId } from './lib/ids.ts';
import { rootDir } from './lib/paths.ts';

function upsertAssets(existing: DerivedAsset[], additions: DerivedAsset[]): DerivedAsset[] {
  return [
    ...existing.filter((asset) => !additions.some((next) => next.assetId === asset.assetId)),
    ...additions,
  ];
}

function readBase64Audio(filePath: string | undefined): string | undefined {
  if (!filePath || !fs.existsSync(filePath)) return undefined;
  return fs.readFileSync(filePath).toString('base64');
}

function renderAssetPath(baseDir: string, roster: VoiceRosterEntry, kind: string): string {
  return path.join(baseDir, `${roster.characterRole}-${roster.personId ?? roster.rosterId}-${kind}.mp3`);
}

function createPlaceholderAsset(
  filePath: string,
  roster: VoiceRosterEntry,
  text: string,
  reason: string,
): void {
  writeTextFile(
    filePath.replace(/\.mp3$/u, '.txt'),
    `Placeholder audio asset\nRole: ${roster.characterRole}\nName: ${roster.displayName}\nText: ${text}\nReason: ${reason}\n`,
  );
}

async function resolveVoiceForRoster(
  apiKey: string,
  roster: VoiceRosterEntry,
  sampleAudioBase64: string | undefined,
  modelId?: string,
): Promise<{ providerVoiceId?: string; providerVoiceName?: string; prompt: string }> {
  const prompt = roster.fallbackPrompt;
  const preview = await createVoiceCloneDraft({
    apiKey,
    name: roster.displayName,
    sampleText: roster.qcSampleText,
    modelId,
  });
  if (preview.voiceId) {
    return {
      providerVoiceId: preview.voiceId,
      providerVoiceName: roster.displayName,
      prompt,
    };
  }

  const designed = await designVoice({
    apiKey,
    voiceDescription: prompt,
    sampleText: roster.qcSampleText,
    modelId,
    referenceAudioBase64: roster.voiceMode === 'real_clone' ? sampleAudioBase64 : undefined,
  });
  if (!designed.voiceId) {
    return { prompt };
  }

  const created = await createVoiceFromDesign({
    apiKey,
    voiceName: roster.displayName,
    voiceDescription: prompt,
    generatedVoiceId: designed.voiceId,
  });

  return {
    providerVoiceId: created.voiceId,
    providerVoiceName: created.voiceName ?? roster.displayName,
    prompt,
  };
}

async function synthesizeOrPlaceholder(input: {
  apiKey: string;
  providerVoiceId?: string;
  filePath: string;
  roster: VoiceRosterEntry;
  text: string;
  modelId?: string;
}): Promise<string> {
  if (!input.providerVoiceId) {
    createPlaceholderAsset(input.filePath, input.roster, input.text, 'No provider voice ID available.');
    return input.filePath.replace(/\.mp3$/u, '.txt');
  }

  try {
    const audio = await synthesizeSpeech({
      apiKey: input.apiKey,
      voiceId: input.providerVoiceId,
      text: input.text,
      modelId: input.modelId,
    });
    writeBinaryFile(input.filePath, audio);
    return input.filePath;
  } catch (error) {
    createPlaceholderAsset(input.filePath, input.roster, input.text, String(error));
    return input.filePath.replace(/\.mp3$/u, '.txt');
  }
}

async function main() {
  loadLocalEnv(rootDir);
  const args = parseArgs(process.argv.slice(2));
  const env = requireEnv({
    required: ['ELEVENLABS_API_KEY'],
    optional: ['ELEVENLABS_MODEL_ID'],
  });
  const caseId = args.caseId;
  if (!caseId) {
    throw new Error('Usage: npm run generate-voice-drafts -- --caseId=<caseId>');
  }

  const bundle = loadCaseBundle(caseId);
  const outputDir = args.outputDir ?? path.join(getCaseDir(caseId), 'assets', 'audio', 'renders');
  ensureDir(outputDir);

  const additions: DerivedAsset[] = [];
  for (const roster of bundle.voiceRoster) {
    const selectedMedia = bundle.media.find((entry) => entry.mediaId === roster.selectedMediaId);
    const sampleAudioBase64 = readBase64Audio(selectedMedia?.localAudioExtractPath ?? selectedMedia?.localRawMediaPath);
    const resolved = await resolveVoiceForRoster(
      env.ELEVENLABS_API_KEY!,
      roster,
      sampleAudioBase64,
      env.ELEVENLABS_MODEL_ID,
    );

    writeTextFile(
      path.join(outputDir, `${roster.rosterId}-voice-model.json`),
      `${JSON.stringify(
        {
          displayName: roster.displayName,
          providerVoiceId: resolved.providerVoiceId,
          providerVoiceName: resolved.providerVoiceName,
          voiceMode: roster.voiceMode,
          prompt: resolved.prompt,
          selectedMediaId: roster.selectedMediaId,
        },
        null,
        2,
      )}\n`,
    );

    additions.push({
      assetId: createId('asset', `${caseId}:${roster.rosterId}:model`),
      caseId,
      personId: roster.personId,
      assetType: roster.voiceMode === 'real_clone' ? 'voice_model' : 'voice_fallback_profile',
      toolProvider: 'elevenlabs',
      voiceMode: roster.voiceMode,
      providerVoiceId: resolved.providerVoiceId,
      providerVoiceName: resolved.providerVoiceName,
      characterRole: roster.characterRole,
      inputMediaIds: roster.selectedMediaId ? [roster.selectedMediaId] : [],
      promptOrRecipe: resolved.prompt,
      modelName: env.ELEVENLABS_MODEL_ID ?? 'eleven_multilingual_v2',
      outputUri: path.join(outputDir, `${roster.rosterId}-voice-model.json`),
      generationDate: new Date().toISOString(),
      qualityScore: selectedMedia?.usableForCloneScore ?? 65,
      approvalStatus: 'needs_review',
      reviewNotes: roster.decisionReason,
    });

    for (const [kind, text] of [
      ['intro', roster.introText],
      ['default', roster.defaultAnswerText],
      ['sample', roster.qcSampleText],
      ['911', roster.render911Text],
      ['reveal', roster.renderRevealText],
    ] as const) {
      if (!text) continue;
      const filePath = renderAssetPath(outputDir, roster, kind);
      const outputUri = await synthesizeOrPlaceholder({
        apiKey: env.ELEVENLABS_API_KEY!,
        providerVoiceId: resolved.providerVoiceId,
        filePath,
        roster,
        text,
        modelId: env.ELEVENLABS_MODEL_ID,
      });

      additions.push({
        assetId: createId('asset', `${caseId}:${roster.rosterId}:${kind}`),
        caseId,
        personId: roster.personId,
        assetType: 'voice_line',
        toolProvider: 'elevenlabs',
        voiceMode: roster.voiceMode,
        providerVoiceId: resolved.providerVoiceId,
        providerVoiceName: resolved.providerVoiceName,
        renderText: text,
        characterRole: roster.characterRole,
        inputMediaIds: roster.selectedMediaId ? [roster.selectedMediaId] : [],
        promptOrRecipe: resolved.prompt,
        modelName: env.ELEVENLABS_MODEL_ID ?? 'eleven_multilingual_v2',
        outputUri,
        generationDate: new Date().toISOString(),
        qualityScore: selectedMedia?.usableForCloneScore ?? 65,
        approvalStatus: 'needs_review',
        reviewNotes: roster.decisionReason,
      });
    }
  }

  saveCaseBundle(caseId, {
    derivedAssets: upsertAssets(bundle.derivedAssets, additions),
    caseRecord: {
      ...bundle.caseRecord,
      assetGenerationStatus: additions.length > 0 ? 'generated' : bundle.caseRecord.assetGenerationStatus,
      updatedAt: new Date().toISOString(),
    },
  });

  console.log(`Generated ${additions.length} voice assets for ${caseId}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
