/**
 * Generates a fresh crime scene image + 3D model and seeds into Convex.
 * Usage: npx tsx scripts/generateCrimeScene.ts
 */
import { ConvexHttpClient } from 'convex/browser';
import { makeFunctionReference } from 'convex/server';
import { loadLocalEnv, requireEnv } from './lib/env.ts';
import { loadCaseBundle, saveCaseBundle } from './lib/caseFiles.ts';
import { createFalImageDraft, createFalImageTo3DDraft } from './lib/fal.ts';
import { parseArgs } from './lib/cli.ts';
import { rootDir } from './lib/paths.ts';

const seedMediaRef = makeFunctionReference<'action'>('media:seedMediaForCaseStringId');

loadLocalEnv(rootDir);
const env = requireEnv({ required: ['FAL_API_KEY', 'VITE_CONVEX_URL'] });
const falKey = env.FAL_API_KEY!;
const client = new ConvexHttpClient(env.VITE_CONVEX_URL!);

const args = parseArgs(process.argv.slice(2));
const caseId = (args['--caseId'] as string | undefined) ?? 'case_colonel_russell_williams_2010';

const SCENE_PROMPT =
  'Photorealistic crime scene exterior, isolated 1920s limestone farmhouse, Highway 37 Hastings County Ontario Canada, ' +
  'late winter night, fresh snow on the ground. ' +

  'Evidence details: ' +
  'deep size-10.5 military boot impressions in snow leading to rear door, ' +
  'yellow numbered forensic evidence placards (A1 A2 A3 A4) placed precisely beside each boot print and near rear entrance, ' +
  'yellow-and-black police tape (DO NOT CROSS) strung low between rusted fence posts and a weathered oak tree, ' +
  'single visible tire tread mark in the driveway snow consistent with an SUV, ' +
  'shattered rear door lock with visible pry marks on the limestone frame, ' +
  'forensic photographer tripod with bright strobe light illuminating the rear entrance, ' +
  'small numbered orange evidence tent near the doorstep, ' +
  'evidence collection kit bag open on the snowy ground beside the door, latex gloves discarded nearby, ' +
  'forensic ruler lying flat next to a boot impression, ' +
  'faint flashlight beam sweeping across the snow from inside through a cracked window. ' +

  'Scene atmosphere: ' +
  'bare skeletal oak trees surrounding the property, ' +
  'two OPP cruisers parked at angle in driveway with roof lights off, ' +
  'cold blue forensic work lights on tripod stands, ' +
  'breath vapour in cold air visible near evidence markers, ' +
  'overcast sky with faint moonlight breaking through, ' +
  'limestone farmhouse walls showing age and weathering, ' +
  'snow undisturbed except near the evidence trail. ' +

  'No people, no blood, no gore. ' +
  'Ultra-high detail, photorealistic, cinematic DSLR photography, 8K resolution, shallow depth of field on evidence markers.';

console.log('Generating crime scene image…');
const imgDraft = await createFalImageDraft({
  apiKey: falKey,
  prompt: SCENE_PROMPT,
  model: 'fal-ai/flux-pro',
  imageSize: 'landscape_16_9',
});

const sceneImageUri = imgDraft.outputUri;
console.log('Scene image:', sceneImageUri);

console.log('Generating 3D model from image (this takes ~2 min)…');
const modelDraft = await createFalImageTo3DDraft({
  apiKey: falKey,
  imageUrl: sceneImageUri,
});

const sceneModelUri = modelDraft.outputUri;
console.log('Scene model:', sceneModelUri);

// Update package.json
const bundle = loadCaseBundle(caseId);
bundle.packageRecord.assetManifest.sceneImageUri = sceneImageUri;
bundle.packageRecord.assetManifest.sceneModelUri = sceneModelUri;
saveCaseBundle(caseId, bundle);
console.log('Updated package.json');

// Seed into Convex
await client.action(seedMediaRef, {
  caseId,
  title: bundle.packageRecord.title,
  sceneImageUrl: sceneImageUri,
  sceneModelUrl: sceneModelUri,
});
console.log('Seeded into Convex ✓');
