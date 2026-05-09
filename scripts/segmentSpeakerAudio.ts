import path from 'node:path';
import fs from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { MediaCandidate } from '../src/types/media.ts';
import { loadCaseBundle, saveCaseBundle, getCaseDir } from './lib/caseFiles.ts';
import { parseArgs } from './lib/cli.ts';
import { loadLocalEnv } from './lib/env.ts';
import { createId } from './lib/ids.ts';
import { rootDir } from './lib/paths.ts';

const execFileAsync = promisify(execFile);
const FFMPEG_BIN = '/opt/homebrew/bin/ffmpeg';
const MAX_CLIP_SECONDS = 120;

async function extractClip(input: { sourcePath: string; clipPath: string }): Promise<void> {
  await execFileAsync(
    FFMPEG_BIN,
    [
      '-y',
      '-i',
      input.sourcePath,
      '-vn',
      '-ac',
      '1',
      '-ar',
      '16000',
      '-t',
      String(MAX_CLIP_SECONDS),
      '-f',
      'mp3',
      input.clipPath,
    ],
    { maxBuffer: 1024 * 1024 * 10 },
  );
}

async function segmentMedia(bundleMedia: MediaCandidate[], clipsDir: string): Promise<MediaCandidate[]> {
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

    const clipPath = path.join(clipsDir, `${entry.mediaId}-clip-1.mp3`);
    if (!fs.existsSync(clipPath)) {
      try {
        await extractClip({ sourcePath: entry.localRawMediaPath, clipPath });
      } catch {
        continue;
      }
    }

    segmented.push({
      ...entry,
      mediaId: createId('clip', `${entry.mediaId}:1`),
      mediaKind: 'audio',
      localStoragePath: clipPath,
      localAudioExtractPath: clipPath,
      speechDurationSec: Math.min(entry.durationSec ?? entry.speechDurationSec ?? 60, MAX_CLIP_SECONDS),
      overlapRatio: entry.overlapRatio ?? 0.08,
      speakerConfidence: entry.speakerConfidence ?? 82,
      transcriptTextPath: entry.transcriptTextPath,
    });
  }

  return segmented;
}

function dedupeMedia(media: MediaCandidate[]): MediaCandidate[] {
  return media.filter(
    (entry, index, all) => all.findIndex((candidate) => candidate.mediaId === entry.mediaId) === index,
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
  const clips = await segmentMedia(bundle.media, clipsDir);
  const media = dedupeMedia([...bundle.media, ...clips]);

  saveCaseBundle(caseId, { media });
  console.log(`Segmented speaker audio for ${caseId}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
