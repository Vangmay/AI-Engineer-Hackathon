import fs from 'node:fs';
import { loadCaseBundle, saveCaseBundle } from './lib/caseFiles.ts';
import { parseArgs } from './lib/cli.ts';
import { loadLocalEnv, requireEnv } from './lib/env.ts';
import { createFalImageDraft, createFalImageTo3DDraft } from './lib/fal.ts';
import { createId } from './lib/ids.ts';
import { rootDir } from './lib/paths.ts';
import type { DerivedAsset } from '../src/types/media.ts';
import type { PersonRecord } from '../src/types/research.ts';

function upsertAssets(existing: DerivedAsset[], additions: DerivedAsset[]): DerivedAsset[] {
  return [
    ...existing.filter((a) => !additions.some((n) => n.assetId === a.assetId)),
    ...additions,
  ];
}

function filePathToDataUri(filePath: string): string {
  const ext = filePath.toLowerCase().split('.').pop();
  const mime =
    ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  const bytes = fs.readFileSync(filePath);
  return `data:${mime};base64,${bytes.toString('base64')}`;
}

async function main() {
  loadLocalEnv(rootDir);
  const args = parseArgs(process.argv.slice(2));
  const env = requireEnv({
    required: ['FAL_API_KEY'],
    optional: ['FAL_IMAGE_TO_3D_MODEL', 'FAL_IMAGE_TO_IMAGE_MODEL'],
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
  const referenceOverrideByPersonId: Record<string, string> = {
    person_russell_williams: `${rootDir}/russel-william-profile.jpeg`,
  };

  const clueWardrobeByPersonId: Record<string, string> = {
    person_russell_williams:
      'full-body winter command presence, dark tailored overcoat over crisp shirt and tie, polished black shoes, leather gloves, subtle Canadian Forces colonel bearing, neatly worn blue beret clipped at the side as a visual clue, posture controlled and rigid',
    person_graham_reid:
      'full-body young local civilian in a worn charcoal peacoat over layered hoodie and henley, dark denim, scuffed winter boots, tense stance, phone half-visible in one hand, emotionally restless ex-boyfriend energy',
    person_colin_fraser:
      'full-body rural contractor in weathered canvas work jacket, plaid flannel, heavy-duty work pants, mud-marked steel-toe boots, tape measure clipped to belt, rough hands, practical blue-collar silhouette',
    person_adam_doyle:
      'full-body logistics sergeant look in neat cold-weather base-duty jacket, muted tactical fleece, pressed utility trousers, dark service boots, clipboard or paperwork folio tucked under one arm, anxious procedural demeanor',
    person_jim_smyth:
      'full-body plainclothes investigator in dark wool coat, conservative shirt and tie, detective notebook in hand, functional leather shoes, composed and observant stance',
    person_carol_lloyd:
      'full-body grieving family representative in respectful winter coat, soft scarf, practical gloves, understated memorial pin, guarded but dignified posture',
    person_erin_mcallister:
      'full-body coworker and friend in office-casual winter layers, cardigan under tailored coat, dark jeans, ankle boots, messenger bag strap, alert and concerned posture',
  };

  function buildFullBodyPrompt(witness: { id: string; name: string }, person: PersonRecord | undefined): string {
    const wardrobe =
      clueWardrobeByPersonId[witness.id] ??
      'full-body adult character wearing realistic weather-appropriate clothing that fits their role in a grounded crime investigation';
    const bio = [person?.profileSummary, person?.personaSummary, person?.shortBio]
      .filter(Boolean)
      .join('. ');
    return [
      `Use the provided portrait of ${witness.name} as facial identity reference.`,
      `Create a full-body character turnaround render for an interactive mystery investigation game.`,
      wardrobe,
      bio,
      'Standing pose, entire body visible from head to toe, neutral studio backdrop, realistic anatomy, readable clothing silhouette, subtle story clue details in apparel only, no floating props, no text, no watermark.',
    ]
      .filter(Boolean)
      .join(' ');
  }

  for (const witness of targets as Array<{ id: string; name: string }>) {
    if (existingWitnessModels[witness.id] && !args.force) {
      console.log(`Skipping ${witness.name} — model already exists (use --force to regenerate)`);
      continue;
    }

    const overridePath = referenceOverrideByPersonId[witness.id];
    const portraitUrl = witnessPortraits[witness.id];
    const referenceImage =
      overridePath && fs.existsSync(overridePath)
        ? filePathToDataUri(overridePath)
        : portraitUrl;
    if (!referenceImage || (!referenceImage.startsWith('http') && !referenceImage.startsWith('data:'))) {
      console.warn(`No usable portrait URL for ${witness.name}, skipping`);
      continue;
    }

    const person = bundle.people.find((entry) => entry.personId === witness.id);
    const sourcePrompt = buildFullBodyPrompt(witness, person);
    console.log(
      `Generating full-body source render for ${witness.name} from: ${
        overridePath && fs.existsSync(overridePath) ? overridePath : portraitUrl
      }`,
    );
    const sourceRender = await createFalImageDraft({
      apiKey: env.FAL_API_KEY!,
      prompt: sourcePrompt,
      imageUrl: referenceImage,
      model: env.FAL_IMAGE_TO_IMAGE_MODEL,
      aspectRatio: '3:4',
    });

    additions.push({
      assetId: createId('asset', `${caseId}:${witness.id}:character-render`),
      caseId,
      personId: witness.id,
      assetType: 'character_render',
      toolProvider: 'fal',
      inputMediaIds: [],
      promptOrRecipe: sourcePrompt,
      modelName: sourceRender.modelName,
      outputUri: sourceRender.outputUri,
      generationDate: now,
      qualityScore: 75,
      approvalStatus: 'needs_review',
      reviewNotes: `Full-body source render for ${witness.name} used to derive the 3D witness model.`,
    });

    console.log(`Generating 3D model for ${witness.name} from: ${sourceRender.outputUri}`);
    const model = await createFalImageTo3DDraft({
      apiKey: env.FAL_API_KEY!,
      imageUrl: sourceRender.outputUri,
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
      promptOrRecipe: `image-to-3D from full-body render: ${sourceRender.outputUri}`,
      modelName: model.modelName,
      outputUri: model.outputUri,
      previewUri: model.previewUri,
      generationDate: now,
      qualityScore: 72,
      approvalStatus: 'needs_review',
      reviewNotes: `Full-body 3D witness model for ${witness.name} with clue-driven apparel.`,
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
