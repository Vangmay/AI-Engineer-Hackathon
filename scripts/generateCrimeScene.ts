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
  'Isolated 1920s limestone farmhouse at night, rural Highway 37 Hastings County Ontario Canada, winter, ' +
  'crime scene investigation, yellow police tape strung between weathered fence posts, ' +
  'numbered yellow evidence placards on snow-dusted ground, forensic flashlight beams casting cold blue light, ' +
  'faint boot impressions in the snow near rear entrance, bare oak trees, ' +
  'distant stars in a dark overcast sky, patrol car headlights off in background, ' +
  'no people, no gore, highly detailed photorealistic render, cinematic, 8K, atmospheric';

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
