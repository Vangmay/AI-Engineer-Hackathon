/**
 * Seeds scene model URL, witness model URLs, and witness portrait URLs into Convex.
 * Usage: npx tsx scripts/seedSceneMedia.ts [--caseId <id>]
 */
import { ConvexHttpClient } from 'convex/browser';
import { makeFunctionReference } from 'convex/server';
import { loadLocalEnv, requireEnv } from './lib/env.ts';
import { loadCaseBundle } from './lib/caseFiles.ts';
import { parseArgs } from './lib/cli.ts';
import { rootDir } from './lib/paths.ts';

const seedMediaRef = makeFunctionReference<'action'>('media:seedMediaForCaseStringId');

loadLocalEnv(rootDir);
const { VITE_CONVEX_URL: convexUrl } = requireEnv({ required: ['VITE_CONVEX_URL'] });
const client = new ConvexHttpClient(convexUrl!);

const args = parseArgs(process.argv.slice(2));
const caseId = (args['--caseId'] as string | undefined) ?? 'case_colonel_russell_williams_2010';

const bundle = await loadCaseBundle(caseId);
const m = bundle.packageRecord.assetManifest;

const result = await client.action(seedMediaRef, {
  caseId,
  title: bundle.packageRecord.title,
  sceneImageUrl: m.sceneImageUri ?? undefined,
  sceneModelUrl: m.sceneModelUri ?? undefined,
  witnessPortraitUrls: Object.keys(m.witnessPortraits ?? {}).length > 0
    ? m.witnessPortraits
    : undefined,
  witnessModelUrls: Object.keys(m.witnessModels ?? {}).length > 0
    ? m.witnessModels
    : undefined,
  evidenceRenders: Object.keys(m.evidenceRenders ?? {}).length > 0
    ? m.evidenceRenders
    : undefined,
  evidenceModels: Object.keys(m.evidenceModels ?? {}).length > 0
    ? m.evidenceModels
    : undefined,
  evidenceModelPreviews: Object.keys(m.evidenceModelPreviews ?? {}).length > 0
    ? m.evidenceModelPreviews
    : undefined,
});

console.log('Seeded:', result);
