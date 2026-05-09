import { loadCaseBundle, saveCaseBundle } from './lib/caseFiles.ts';
import { parseArgs } from './lib/cli.ts';
import { loadLocalEnv, requireEnv } from './lib/env.ts';
import { createFalImageTo3DDraft } from './lib/fal.ts';
import { createId } from './lib/ids.ts';
import { rootDir } from './lib/paths.ts';
import type { DerivedAsset } from '../src/types/media.ts';

function upsertAssets(existing: DerivedAsset[], additions: DerivedAsset[]): DerivedAsset[] {
  return [
    ...existing.filter((a) => !additions.some((n) => n.assetId === a.assetId)),
    ...additions,
  ];
}

async function main() {
  loadLocalEnv(rootDir);
  const args = parseArgs(process.argv.slice(2));
  const env = requireEnv({
    required: ['FAL_API_KEY'],
    optional: ['FAL_IMAGE_TO_3D_MODEL'],
  });

  const caseId = args.caseId;
  if (!caseId) {
    throw new Error('Usage: npm run generate-witness-models -- --caseId=<caseId>');
  }

  const bundle = loadCaseBundle(caseId);
  const runtimeCase = bundle.packageRecord?.runtimeCase;
  if (!runtimeCase) {
    throw new Error(`Case "${caseId}" has no package.json runtimeCase.`);
  }

  const existingWitnessModels: Record<string, string> =
    (bundle.packageRecord?.assetManifest as { witnessModels?: Record<string, string> })
      ?.witnessModels ?? {};
  const witnessPortraits: Record<string, string> =
    (bundle.packageRecord?.assetManifest as { witnessPortraits?: Record<string, string> })
      ?.witnessPortraits ?? {};

  const additions: DerivedAsset[] = [];
  const witnessModels: Record<string, string> = { ...existingWitnessModels };
  const now = new Date().toISOString();

  const witnesses = runtimeCase.witnesses ?? [];
  const targetId = args.witnessId as string | undefined;
  const targets = targetId ? witnesses.filter((w: { id: string }) => w.id === targetId) : witnesses;

  for (const witness of targets as Array<{ id: string; name: string }>) {
    if (existingWitnessModels[witness.id] && !args.force) {
      console.log(`Skipping ${witness.name} — model already exists (use --force to regenerate)`);
      continue;
    }

    const portraitUrl = witnessPortraits[witness.id];
    if (!portraitUrl || !portraitUrl.startsWith('http')) {
      console.warn(`No usable portrait URL for ${witness.name}, skipping`);
      continue;
    }

    console.log(`Generating 3D model for ${witness.name} from: ${portraitUrl}`);
    const model = await createFalImageTo3DDraft({
      apiKey: env.FAL_API_KEY!,
      imageUrl: portraitUrl,
      model: env.FAL_IMAGE_TO_3D_MODEL,
    });

    witnessModels[witness.id] = model.outputUri;
    additions.push({
      assetId: createId('asset', `${caseId}:${witness.id}:model`),
      caseId,
      personId: witness.id,
      assetType: 'face_model',
      toolProvider: 'fal',
      inputMediaIds: [],
      promptOrRecipe: `image-to-3D from portrait: ${portraitUrl}`,
      modelName: model.modelName,
      outputUri: model.outputUri,
      previewUri: model.previewUri,
      generationDate: now,
      qualityScore: 72,
      approvalStatus: 'needs_review',
      reviewNotes: `3D witness model for ${witness.name}.`,
    });
    console.log(`  → ${model.outputUri}`);
  }

  if (additions.length === 0) {
    console.log('No new models generated.');
    return;
  }

  saveCaseBundle(caseId, {
    derivedAssets: upsertAssets(bundle.derivedAssets, additions),
    packageRecord: bundle.packageRecord
      ? {
          ...bundle.packageRecord,
          assetManifest: {
            ...bundle.packageRecord.assetManifest,
            witnessModels,
          },
        }
      : undefined,
    caseRecord: {
      ...bundle.caseRecord,
      updatedAt: new Date().toISOString(),
    },
  });

  console.log(`Done — ${additions.length} witness model(s) added to package.json`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
