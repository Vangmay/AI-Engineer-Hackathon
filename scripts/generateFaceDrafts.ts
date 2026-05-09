import path from 'node:path';
import type { DerivedAsset } from '../src/types/media.ts';
import { loadCaseBundle, saveCaseBundle, getCaseDir } from './lib/caseFiles.ts';
import { parseArgs } from './lib/cli.ts';
import { loadLocalEnv, requireEnv } from './lib/env.ts';
import { createFalImageDraft, isUsableFalInputUrl } from './lib/fal.ts';
import { ensureDir } from './lib/fs.ts';
import { createId } from './lib/ids.ts';
import { rootDir } from './lib/paths.ts';

function upsertAssets(existing: DerivedAsset[], additions: DerivedAsset[]): DerivedAsset[] {
  return [...existing.filter((asset) => !additions.some((next) => next.assetId === asset.assetId)), ...additions];
}

async function main() {
  loadLocalEnv(rootDir);
  const args = parseArgs(process.argv.slice(2));
  const env = requireEnv({
    required: ['FAL_API_KEY'],
    optional: ['FAL_MODEL', 'FAL_IMAGE_MODEL', 'FAL_IMAGE_TO_IMAGE_MODEL'],
  });
  const caseId = args.caseId;
  if (!caseId) {
    throw new Error('Usage: npm run generate-face-drafts -- --caseId=<caseId>');
  }

  const bundle = loadCaseBundle(caseId);
  const outputDir = args.outputDir ?? path.join(getCaseDir(caseId), 'assets', 'faces');
  ensureDir(outputDir);

  const additions: DerivedAsset[] = [];
  for (const person of bundle.people.filter(
    (entry) => entry.isPrimaryCharacter && entry.roleType !== 'victim',
  )) {
    const media = bundle.media
      .filter((entry) => entry.personId === person.personId && entry.mediaKind === 'image')
      .sort((a, b) => b.usableForCloneScore - a.usableForCloneScore)[0];
    const referenceUrl = isUsableFalInputUrl(media?.url) ? media?.url : undefined;

    const prompt = referenceUrl
      ? [
          `Use the provided source image of ${person.fullName} as identity reference.`,
          'Create an evidence-board witness portrait for a cinematic Singapore true-crime game.',
          'Maintain adult facial identity and recognizable features, but render as a polished editorial dossier photograph.',
          'Neutral background, direct gaze, restrained expression, realistic lighting, no text.',
        ].join(' ')
      : [
          `Editorial witness portrait for ${person.fullName}.`,
          `${person.shortBio}. ${person.nationality ?? 'Singaporean'} adult.`,
          'Cinematic true-crime dossier photograph, direct gaze, neutral background, realistic lighting, no text.',
        ].join(' ');
    const result = await createFalImageDraft({
      apiKey: env.FAL_API_KEY!,
      prompt,
      imageUrl: referenceUrl,
      model: referenceUrl
        ? (env.FAL_IMAGE_TO_IMAGE_MODEL ?? env.FAL_MODEL)
        : (env.FAL_IMAGE_MODEL ?? env.FAL_MODEL),
      aspectRatio: '3:4',
    });

    additions.push({
      assetId: createId('asset', `${caseId}:${person.personId}:face`),
      caseId,
      personId: person.personId,
      assetType: 'portrait',
      toolProvider: 'fal',
      inputMediaIds: media ? [media.mediaId] : [],
      promptOrRecipe: prompt,
      modelName: result.modelName,
      outputUri: result.outputUri,
      generationDate: new Date().toISOString(),
      qualityScore: media?.usableForCloneScore ?? person.mediaRichnessScore,
      similarityScore: media?.faceVisibilityScore,
      approvalStatus: 'needs_review',
      reviewNotes: referenceUrl
        ? `Generated from data media URL: ${referenceUrl}`
        : 'Generated from person metadata because no fal-usable image URL was available in /data.',
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

  console.log(`Generated ${additions.length} face draft records for ${caseId}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
