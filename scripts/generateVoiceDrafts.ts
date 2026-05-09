import path from 'node:path';
import type { DerivedAsset, VoiceRosterEntry } from '../src/types/media.ts';
import { loadCaseBundle, saveCaseBundle, getCaseDir } from './lib/caseFiles.ts';
import { parseArgs } from './lib/cli.ts';
import { createVoiceFromDesign, designVoice, listAvailableVoices, synthesizeSpeech } from './lib/elevenlabs.ts';
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

function makeProviderSafeVoiceName(roster: VoiceRosterEntry): string {
  return `case-${roster.caseId}-${roster.characterRole}-${roster.rosterId.slice(-6)}`;
}

function ensureVoiceDesignSampleText(roster: VoiceRosterEntry): string {
  const minimumLength = 100;
  const base =
    roster.qcSampleText ||
    `${roster.displayName} is delivering a controlled review sample for gameplay voice generation.`;
  if (base.length >= minimumLength) {
    return base.slice(0, 1000);
  }

  const supplemental =
    ` The voice should sound appropriate for the role of ${roster.characterRole}, maintain natural pacing, and provide enough spoken variation to assess quality, identity consistency, and suitability for interactive interrogation scenes.`;
  const expanded = `${base}${supplemental}`;
  return expanded.length >= minimumLength
    ? expanded.slice(0, 1000)
    : `${expanded} Additional review speech is included to satisfy minimum sample length requirements.`.slice(
        0,
        1000,
      );
}

async function resolveVoiceForRoster(
  apiKey: string,
  roster: VoiceRosterEntry,
  modelId?: string,
): Promise<{ providerVoiceId?: string; providerVoiceName?: string; prompt: string; blocked?: boolean }> {
  const prompt = roster.fallbackPrompt;
  const sampleText = ensureVoiceDesignSampleText(roster);
  const providerSafeName = makeProviderSafeVoiceName(roster);
  const availableVoices = await listAvailableVoices(apiKey);
  const existingSafeVoice = availableVoices.find((voice) => voice.name === providerSafeName);
  if (existingSafeVoice) {
    return {
      providerVoiceId: existingSafeVoice.voiceId,
      providerVoiceName: existingSafeVoice.name,
      prompt,
    };
  }

  const designed = await designVoice({
    apiKey,
    voiceDescription: prompt,
    sampleText,
    modelId,
  });
  if (designed.blocked) {
    const safeVoice = availableVoices.find((voice) => voice.category === 'premade') ?? availableVoices[0];
    return {
      providerVoiceId: safeVoice?.voiceId,
      providerVoiceName: safeVoice?.name,
      prompt,
      blocked: true,
    };
  }
  if (!designed.voiceId) {
    const safeVoice = availableVoices.find((voice) => voice.category === 'premade') ?? availableVoices[0];
    return {
      providerVoiceId: safeVoice?.voiceId,
      providerVoiceName: safeVoice?.name,
      prompt,
    };
  }

  const created = await createVoiceFromDesign({
    apiKey,
    voiceName: providerSafeName,
    voiceDescription: prompt,
    generatedVoiceId: designed.voiceId,
  });
  if (created.blocked) {
    const safeVoice = availableVoices.find((voice) => voice.category === 'premade') ?? availableVoices[0];
    return {
      providerVoiceId: safeVoice?.voiceId,
      providerVoiceName: safeVoice?.name,
      prompt,
      blocked: true,
    };
  }

  return {
    providerVoiceId: created.voiceId,
    providerVoiceName: created.voiceName ?? providerSafeName,
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
    const selectedMedia = roster.selectedMediaId
      ? bundle.media.find((entry) => entry.mediaId === roster.selectedMediaId)
      : undefined;
    const resolved = await resolveVoiceForRoster(env.ELEVENLABS_API_KEY!, roster, env.ELEVENLABS_MODEL_ID);

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
      assetType: 'voice_fallback_profile',
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
        reviewNotes: resolved.blocked
          ? `${roster.decisionReason} ElevenLabs blocked prompt generation; placeholder asset written.`
          : roster.decisionReason,
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
