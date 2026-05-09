import fs from 'node:fs';
import path from 'node:path';
import { ConvexHttpClient } from 'convex/browser';
import { makeFunctionReference } from 'convex/server';
import type { GameCasePackage } from '../src/types/gamePackage.ts';
import type { DerivedAsset, VoiceRosterEntry } from '../src/types/media.ts';
import { parseArgs } from './lib/cli.ts';
import { loadLocalEnv, requireEnv } from './lib/env.ts';
import { loadCaseBundle } from './lib/caseFiles.ts';
import { rootDir } from './lib/paths.ts';

type AudioKind = 'intro' | 'default' | 'sample' | 'call911' | 'reveal' | 'ambient' | 'other';

interface UploadDescriptor {
  assetKey: string;
  sourceAssetId: string;
  kind: AudioKind;
  filePath: string;
  witnessId?: string;
  characterRole?: string;
  renderText?: string;
  providerVoiceId?: string;
}

const upsertGamePackageRef = makeFunctionReference<'mutation'>('imports:upsertGamePackage');
const listCaseAudioAssetsRef = makeFunctionReference<'query'>('media:listCaseAudioAssets');
const generateUploadUrlRef = makeFunctionReference<'mutation'>('media:generateUploadUrl');
const saveUploadedAudioAssetsRef = makeFunctionReference<'mutation'>('media:saveUploadedAudioAssets');

function isTruthyFlag(value: string | undefined): boolean {
  return value === 'true' || value === '1' || value === 'yes';
}

function isPlayableAudioAsset(asset: DerivedAsset): boolean {
  if (asset.approvalStatus === 'draft' || asset.approvalStatus === 'rejected') return false;
  if (asset.assetType !== 'voice_line' && asset.assetType !== 'ambient_audio') return false;
  return /\.(mp3|wav|m4a|aac|ogg|opus)$/iu.test(asset.outputUri);
}

function normalizeCaseAssetPath(caseId: string, outputUri: string): string | null {
  const trimmed = outputUri.trim();
  if (!trimmed || trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) {
    return null;
  }
  if (path.isAbsolute(trimmed)) return trimmed;

  const caseRoot = path.join(rootDir, 'data', 'cases', caseId);
  const caseAssetsPrefix = `/case-assets/${caseId}/`;
  if (trimmed.startsWith(caseAssetsPrefix)) {
    return path.join(caseRoot, trimmed.slice(caseAssetsPrefix.length));
  }

  return path.resolve(caseRoot, trimmed);
}

function contentTypeForFile(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.wav':
      return 'audio/wav';
    case '.m4a':
      return 'audio/mp4';
    case '.aac':
      return 'audio/aac';
    case '.ogg':
      return 'audio/ogg';
    case '.opus':
      return 'audio/ogg';
    case '.mp3':
    default:
      return 'audio/mpeg';
  }
}

function classifyAudioKind(asset: DerivedAsset, voiceRoster: VoiceRosterEntry[]): AudioKind {
  if (asset.assetType === 'ambient_audio') return 'ambient';

  const rosterByPerson = new Map(
    voiceRoster.filter((entry) => entry.personId).map((entry) => [entry.personId!, entry]),
  );
  const caller = voiceRoster.find((entry) => entry.characterRole === 'caller_911');
  const narrator = voiceRoster.find((entry) => entry.characterRole === 'narrator');
  const roster = asset.personId ? rosterByPerson.get(asset.personId) : undefined;

  if (asset.characterRole === 'caller_911') {
    if (asset.renderText && asset.renderText === caller?.render911Text) return 'call911';
    if (asset.renderText && asset.renderText === caller?.qcSampleText) return 'sample';
    return 'other';
  }
  if (asset.characterRole === 'narrator') {
    if (asset.renderText && asset.renderText === narrator?.renderRevealText) return 'reveal';
    if (asset.renderText && asset.renderText === narrator?.qcSampleText) return 'sample';
    return 'other';
  }
  if (!roster) return 'other';
  if (asset.renderText && asset.renderText === roster.introText) return 'intro';
  if (asset.renderText && asset.renderText === roster.defaultAnswerText) return 'default';
  if (asset.renderText && asset.renderText === roster.qcSampleText) return 'sample';
  return 'other';
}

function collectUploadDescriptors(caseId: string, assets: DerivedAsset[], voiceRoster: VoiceRosterEntry[]): UploadDescriptor[] {
  const descriptors: UploadDescriptor[] = [];

  for (const asset of assets) {
    if (!isPlayableAudioAsset(asset)) continue;
    const filePath = normalizeCaseAssetPath(caseId, asset.outputUri);
    if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) continue;

    descriptors.push({
      assetKey: asset.assetId,
      sourceAssetId: asset.assetId,
      kind: classifyAudioKind(asset, voiceRoster),
      filePath,
      witnessId: asset.personId,
      characterRole: asset.characterRole,
      renderText: asset.renderText,
      providerVoiceId: asset.providerVoiceId,
    });
  }

  return descriptors;
}

function listCaseDirs(selectedCaseId?: string): string[] {
  const casesRoot = path.join(rootDir, 'data', 'cases');
  const names = fs
    .readdirSync(casesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  return selectedCaseId ? names.filter((name) => name === selectedCaseId) : names;
}

async function uploadFile(uploadUrl: string, filePath: string): Promise<string> {
  const body = await fs.promises.readFile(filePath);
  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: { 'Content-Type': contentTypeForFile(filePath) },
    body,
  });
  if (!response.ok) {
    throw new Error(`Upload failed for ${path.basename(filePath)}: ${response.status} ${await response.text()}`);
  }

  const payload = (await response.json()) as { storageId?: string };
  if (!payload.storageId) {
    throw new Error(`Upload succeeded without storageId for ${path.basename(filePath)}.`);
  }
  return payload.storageId;
}

async function main() {
  loadLocalEnv(rootDir);
  const args = parseArgs(process.argv.slice(2));
  const env = requireEnv({
    required: ['VITE_CONVEX_URL'],
  });

  const client = new ConvexHttpClient(env.VITE_CONVEX_URL!);
  const force = isTruthyFlag(args.force);
  const targetCaseId = args.caseId;
  const caseDirs = listCaseDirs(targetCaseId);
  if (caseDirs.length === 0) {
    throw new Error(targetCaseId ? `No case directory found for ${targetCaseId}.` : 'No case directories found.');
  }

  let importedCases = 0;
  let uploadedAssets = 0;
  const skipped: string[] = [];

  for (const localCaseId of caseDirs) {
    const bundle = loadCaseBundle(localCaseId);
    const packageRecord = bundle.packageRecord as GameCasePackage | undefined;

    if (!packageRecord) {
      skipped.push(`${localCaseId}: missing package.json`);
      continue;
    }

    const descriptors = collectUploadDescriptors(localCaseId, bundle.derivedAssets, bundle.voiceRoster);
    if (descriptors.length === 0) {
      skipped.push(`${localCaseId}: no playable audio assets found`);
      continue;
    }

    const imported = (await client.mutation(upsertGamePackageRef, {
      packageRecord,
      caseRecord: bundle.caseRecord,
    })) as { caseId: string };

    const existingAssets = (await client.query(listCaseAudioAssetsRef, {
      caseId: imported.caseId,
    })) as Array<{ assetKey: string }>;
    const existingKeys = new Set(existingAssets.map((asset) => asset.assetKey));

    const pendingDescriptors = force
      ? descriptors
      : descriptors.filter((descriptor) => !existingKeys.has(descriptor.assetKey));

    if (pendingDescriptors.length === 0) {
      importedCases += 1;
      console.log(`Skipped uploads for ${localCaseId}; Convex already has ${descriptors.length} audio assets.`);
      continue;
    }

    const uploaded = [];
    for (const descriptor of pendingDescriptors) {
      const uploadUrl = (await client.mutation(generateUploadUrlRef, {})) as string;
      const storageId = await uploadFile(uploadUrl, descriptor.filePath);
      uploaded.push({
        assetKey: descriptor.assetKey,
        kind: descriptor.kind,
        storageId,
        witnessId: descriptor.witnessId,
        characterRole: descriptor.characterRole,
        renderText: descriptor.renderText,
        sourceAssetId: descriptor.sourceAssetId,
        providerVoiceId: descriptor.providerVoiceId,
      });
    }

    await client.mutation(saveUploadedAudioAssetsRef, {
      caseId: imported.caseId,
      assets: uploaded,
    });

    importedCases += 1;
    uploadedAssets += uploaded.length;
    console.log(`Uploaded ${uploaded.length} audio assets for ${localCaseId}.`);
  }

  console.log(
    `Convex audio upload complete. Imported ${importedCases} case(s), uploaded ${uploadedAssets} audio asset(s).`,
  );
  if (skipped.length > 0) {
    console.log('Skipped cases:');
    for (const entry of skipped) {
      console.log(`- ${entry}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
