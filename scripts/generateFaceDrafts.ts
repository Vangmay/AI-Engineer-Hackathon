import path from 'node:path';
import type { DerivedAsset } from '../src/types/media.ts';
import { loadCaseBundle, saveCaseBundle, getCaseDir } from './lib/caseFiles.ts';
import { parseArgs } from './lib/cli.ts';
import { loadLocalEnv, requireEnv } from './lib/env.ts';
import { createFalImageDraft } from './lib/fal.ts';
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
    optional: ['FAL_MODEL'],
  });
  const caseId = args.caseId;
  if (!caseId) {
    throw new Error('Usage: npm run generate-face-drafts -- --caseId=<caseId>');
  }

  const bundle = loadCaseBundle(caseId);
  const outputDir = args.outputDir ?? path.join(getCaseDir(caseId), 'assets', 'faces');
  ensureDir(outputDir);

  const additions: DerivedAsset[] = [];
  for (const person of bundle.people.filter((entry) => entry.faceCloneCandidate)) {
    const media = bundle.media
      .filter((entry) => entry.personId === person.personId && entry.mediaKind === 'image')
      .sort((a, b) => b.usableForCloneScore - a.usableForCloneScore)[0];
    if (!media) continue;

    const prompt = `Editorial portrait inspired by ${person.fullName}. Documentary true-crime board game character card.`;
    const result = await createFalImageDraft({
      apiKey: env.FAL_API_KEY!,
      prompt,
      model: env.FAL_MODEL,
    });

    additions.push({
      assetId: createId('asset', `${caseId}:${person.personId}:face`),
      caseId,
      personId: person.personId,
      assetType: 'portrait',
      toolProvider: 'fal',
      inputMediaIds: [media.mediaId],
      promptOrRecipe: prompt,
      modelName: result.modelName,
      outputUri: result.outputUri,
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

  console.log(`Generated ${additions.length} face draft records for ${caseId}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
