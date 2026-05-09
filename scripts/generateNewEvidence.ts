/**
 * Generates new evidence 3D models (Nissan Pathfinder, murder weapon, OPP cruiser)
 * and seeds them into Convex alongside the existing evidence.
 */
import { ConvexHttpClient } from 'convex/browser';
import { makeFunctionReference } from 'convex/server';
import { loadLocalEnv, requireEnv } from './lib/env.ts';
import { loadCaseBundle, saveCaseBundle } from './lib/caseFiles.ts';
import { createFalImageDraft, createFalImageTo3DDraft } from './lib/fal.ts';
import { rootDir } from './lib/paths.ts';

const seedMediaRef = makeFunctionReference<'action'>('media:seedMediaForCaseStringId');

loadLocalEnv(rootDir);
const env = requireEnv({ required: ['FAL_API_KEY', 'VITE_CONVEX_URL'] });
const falKey = env.FAL_API_KEY!;
const client = new ConvexHttpClient(env.VITE_CONVEX_URL!);

const caseId = 'case_colonel_russell_williams_2010';

const NEW_EVIDENCE = [
  {
    key: 'vehicle',
    imagePrompt:
      'Forensic evidence photograph: dark navy-black Nissan Pathfinder SUV parked on a rural Ontario road shoulder, ' +
      'late winter night, snow on ground, driver-side door slightly ajar, ' +
      'OPP police forensic tape around perimeter, numbered yellow evidence placards beside rear tire, ' +
      'Bridgestone Blizzak tire tread clearly visible in compacted snow beside vehicle, ' +
      'forensic work light illuminating the tire tread, close-up detail, ' +
      'no people, photorealistic DSLR crime scene photograph, 8K, cinematic',
  },
  {
    key: 'weapon',
    imagePrompt:
      'Forensic evidence photograph: crime scene evidence table, isolated black military-grade 3-cell Maglite flashlight ' +
      'with dried blood trace on end cap, evidence tag #RW-07 attached, ' +
      'coiled nylon utility rope cut to 1.2-metre length beside it, ' +
      'both items on sterile white forensic examination sheet, ' +
      'plastic evidence bags labelled EXHIBIT 7 and EXHIBIT 8 visible, ' +
      'cold forensic light overhead, macro lens, no people, ' +
      'photorealistic, ultra-high-detail crime scene photography, 8K',
  },
  {
    key: 'cruiser',
    imagePrompt:
      'Forensic scene photograph: OPP Ontario Provincial Police patrol cruiser, white Ford Crown Victoria with blue-and-gold livery, ' +
      'parked at an angle in front of isolated limestone farmhouse driveway, ' +
      'emergency roof bar lights off, door open, winter night, snow on hood, ' +
      'yellow crime scene tape visible in foreground, ' +
      'no people, photorealistic, wide angle, 8K, cinematic night scene',
  },
];

const bundle = loadCaseBundle(caseId);
const existingEvidenceRenders = bundle.packageRecord.assetManifest.evidenceRenders ?? {};
const existingEvidenceModels = bundle.packageRecord.assetManifest.evidenceModels ?? {};
const existingEvidencePreviews = bundle.packageRecord.assetManifest.evidenceModelPreviews ?? {};

// Offset index so new items start after existing 4 (indices 4, 5, 6)
const BASE_IDX = Object.keys(existingEvidenceRenders).length;

for (let i = 0; i < NEW_EVIDENCE.length; i++) {
  const item = NEW_EVIDENCE[i]!;
  const idx = String(BASE_IDX + i);

  console.log(`\n[${i + 1}/${NEW_EVIDENCE.length}] Generating image for: ${item.key}…`);
  const imgDraft = await createFalImageDraft({
    apiKey: falKey,
    prompt: item.imagePrompt,
    model: 'fal-ai/flux-pro',
    imageSize: 'square_hd',
  });
  const imageUrl = imgDraft.outputUri;
  console.log(`  Image: ${imageUrl}`);

  console.log(`  Generating 3D model (~2 min)…`);
  const modelDraft = await createFalImageTo3DDraft({
    apiKey: falKey,
    imageUrl,
  });
  const modelUrl = modelDraft.outputUri;
  console.log(`  Model: ${modelUrl}`);

  existingEvidenceRenders[idx] = imageUrl;
  existingEvidencePreviews[idx] = imageUrl;
  existingEvidenceModels[idx] = modelUrl;
}

// Write back
bundle.packageRecord.assetManifest.evidenceRenders = existingEvidenceRenders;
bundle.packageRecord.assetManifest.evidenceModels = existingEvidenceModels;
bundle.packageRecord.assetManifest.evidenceModelPreviews = existingEvidencePreviews;

// Extend clues in runtimeCase to match new evidence indices
const newClues = [
  'Dark navy-black Nissan Pathfinder SUV — tire tread impressions in snow near victim\'s residence matched forensically to this vehicle, breaking the case open.',
  'Military-grade Maglite flashlight (3-cell, black) used as blunt-force weapon, recovered with forensic trace; nylon utility rope, 1.2 m, identified as ligature in strangulation.',
  'OPP Ontario Provincial Police cruiser — first responder vehicle, establishing the outer perimeter of the Belleville scene on January 29, 2010.',
];
const existingClues = bundle.packageRecord.runtimeCase.clues as string[];
for (const clue of newClues) {
  if (!existingClues.includes(clue)) existingClues.push(clue);
}

saveCaseBundle(caseId, bundle);
console.log('\nUpdated package.json with new evidence');

// Seed all evidence into Convex
await client.action(seedMediaRef, {
  caseId,
  title: bundle.packageRecord.title,
  evidenceRenders: existingEvidenceRenders,
  evidenceModels: existingEvidenceModels,
  evidenceModelPreviews: existingEvidencePreviews,
});
console.log('Seeded into Convex ✓');
