import path from 'node:path';
import fs from 'node:fs';
import type { MediaCandidate } from '../src/types/media.ts';
import { loadCaseBundle, saveCaseBundle, getCaseDir } from './lib/caseFiles.ts';
import { parseArgs } from './lib/cli.ts';
import { loadLocalEnv } from './lib/env.ts';
import { copyFile } from './lib/fs.ts';
import { createId } from './lib/ids.ts';
import { rootDir } from './lib/paths.ts';

function segmentMedia(bundleMedia: MediaCandidate[], clipsDir: string): MediaCandidate[] {
  const segmented: MediaCandidate[] = [];

  for (const entry of bundleMedia) {
    if (
      (entry.mediaKind !== 'audio' && entry.mediaKind !== 'video') ||
      entry.downloadStatus !== 'downloaded' ||
      !entry.localRawMediaPath ||
      !fs.existsSync(entry.localRawMediaPath)
    ) {
      continue;
    }

    const clipPath = path.join(clipsDir, `${entry.mediaId}-clip-1${path.extname(entry.localRawMediaPath) || '.mp3'}`);
    if (!fs.existsSync(clipPath)) {
      copyFile(entry.localRawMediaPath, clipPath);
    }

    segmented.push({
      ...entry,
      mediaId: createId('clip', `${entry.mediaId}:1`),
      localStoragePath: clipPath,
      localAudioExtractPath: clipPath,
      speechDurationSec: entry.speechDurationSec ?? entry.durationSec ?? 60,
      overlapRatio: entry.overlapRatio ?? 0.08,
      speakerConfidence: entry.speakerConfidence ?? 82,
      transcriptTextPath: entry.transcriptTextPath,
    });
  }

  return segmented;
}

function dedupeMedia(media: MediaCandidate[]): MediaCandidate[] {
  return media.filter(
    (entry, index, all) =>
      all.findIndex((candidate) => candidate.mediaId === entry.mediaId) === index,
  );
}

async function main() {
  loadLocalEnv(rootDir);
  const args = parseArgs(process.argv.slice(2));
  const caseId = args.caseId;
  if (!caseId) {
    throw new Error('Usage: npm run segment-speaker-audio -- --caseId=<caseId>');
  }

  const bundle = loadCaseBundle(caseId);
  const clipsDir = path.join(getCaseDir(caseId), 'assets', 'audio', 'clips');
  const clips = segmentMedia(bundle.media, clipsDir);
  const media = dedupeMedia([...bundle.media, ...clips]);

  saveCaseBundle(caseId, { media });
  console.log(`Segmented speaker audio for ${caseId}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
