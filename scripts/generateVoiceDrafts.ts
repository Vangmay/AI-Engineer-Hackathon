import path from 'node:path';
import type { DerivedAsset } from '../src/types/media.ts';
import { loadCaseBundle, saveCaseBundle, getCaseDir } from './lib/caseFiles.ts';
import { parseArgs } from './lib/cli.ts';
import { createVoiceCloneDraft } from './lib/elevenlabs.ts';
import { loadLocalEnv, requireEnv } from './lib/env.ts';
import { createId } from './lib/ids.ts';
import { ensureDir } from './lib/fs.ts';
import { rootDir } from './lib/paths.ts';
import { writeAssetPlaceholder } from './lib/pipeline.ts';

function upsertAssets(existing: DerivedAsset[], additions: DerivedAsset[]): DerivedAsset[] {
  return [...existing.filter((asset) => !additions.some((next) => next.assetId === asset.assetId)), ...additions];
}

async function main() {
  loadLocalEnv(rootDir);
  const args = parseArgs(process.argv.slice(2));
  const env = requireEnv({
    required: ['ELEVENLABS_API_KEY'],
    optional: ['ELEVENLABS_MODEL_ID', 'VOICE_SAMPLE_TEXT_PATH'],
  });
  const caseId = args.caseId;
  if (!caseId) {
    throw new Error('Usage: npm run generate-voice-drafts -- --caseId=<caseId>');
  }

  const bundle = loadCaseBundle(caseId);
  const outputDir = args.outputDir ?? path.join(getCaseDir(caseId), 'assets', 'voice');
  ensureDir(outputDir);

  const additions: DerivedAsset[] = [];
  for (const person of bundle.people.filter((entry) => entry.voiceCloneCandidate)) {
    const media = bundle.media
      .filter((entry) => entry.personId === person.personId && entry.usableForCloneScore >= 75)
      .sort((a, b) => b.usableForCloneScore - a.usableForCloneScore)[0];
    if (!media) continue;

    const previewText = `${person.fullName} recounts a critical detail from ${bundle.caseRecord.canonicalTitle}.`;
    const voiceDraft = await createVoiceCloneDraft({
      apiKey: env.ELEVENLABS_API_KEY!,
      name: person.fullName,
      sampleText: previewText,
      modelId: env.ELEVENLABS_MODEL_ID,
    });
    const outputUri = path.join(outputDir, `${person.personId}.txt`);
    writeAssetPlaceholder(
      outputUri,
      `Voice draft placeholder for ${person.fullName}\nVoice ID: ${voiceDraft.voiceId ?? 'lookup_only'}\nPreview: ${voiceDraft.previewText}\n`,
    );

    additions.push({
      assetId: createId('asset', `${caseId}:${person.personId}:voice`),
      caseId,
      personId: person.personId,
      assetType: 'voice_line',
      toolProvider: 'elevenlabs',
      inputMediaIds: [media.mediaId],
      promptOrRecipe: previewText,
      modelName: env.ELEVENLABS_MODEL_ID ?? 'eleven_multilingual_v2',
      outputUri,
      generationDate: new Date().toISOString(),
      qualityScore: media.usableForCloneScore,
      approvalStatus: 'needs_review',
    });
  }

  saveCaseBundle(caseId, {
    derivedAssets: upsertAssets(bundle.derivedAssets, additions),
    caseRecord: {
      ...bundle.caseRecord,
      assetGenerationStatus: additions.length > 0 ? 'generated' : bundle.caseRecord.assetGenerationStatus,
      updatedAt: new Date().toISOString(),
    },
  });

  console.log(`Generated ${additions.length} voice draft records for ${caseId}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
