import path from 'node:path';
import fs from 'node:fs';
import { pipeline as streamPipeline } from 'node:stream/promises';
import type { MediaCandidate } from '../src/types/media.ts';
import ytdl from '@distube/ytdl-core';
import { loadCaseBundle, saveCaseBundle, getCaseDir } from './lib/caseFiles.ts';
import { parseArgs } from './lib/cli.ts';
import { loadLocalEnv, requireEnv } from './lib/env.ts';
import { writeBinaryFile } from './lib/fs.ts';
import { fileExtensionFromUrl } from './lib/ids.ts';
import { rootDir } from './lib/paths.ts';

async function downloadFile(url: string): Promise<{ bytes: Uint8Array; contentType: string | null }> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Download failed: ${response.status} ${response.statusText}`);
  }
  return {
    bytes: new Uint8Array(await response.arrayBuffer()),
    contentType: response.headers.get('content-type'),
  };
}

function isYouTubeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be'].includes(
      parsed.hostname,
    );
  } catch {
    return false;
  }
}

async function downloadYouTubeMedia(input: {
  url: string;
  targetPathWithoutExt: string;
}): Promise<{ localRawMediaPath: string; contentType: string | null; durationSec?: number }> {
  const info = await ytdl.getInfo(input.url);
  const preferredFormat =
    info.formats
      .filter((format) => format.hasAudio)
      .sort((a, b) => {
        const audioBitrateA = a.audioBitrate ?? 0;
        const audioBitrateB = b.audioBitrate ?? 0;
        const videoPenaltyA = a.hasVideo ? 0 : 1;
        const videoPenaltyB = b.hasVideo ? 0 : 1;
        return videoPenaltyB - videoPenaltyA || audioBitrateB - audioBitrateA;
      })[0] ?? null;

  if (!preferredFormat?.itag) {
    throw new Error('No downloadable YouTube format with audio was available.');
  }

  const ext = preferredFormat.container || 'mp4';
  const localRawMediaPath = `${input.targetPathWithoutExt}.${ext}`;
  await streamPipeline(
    ytdl.downloadFromInfo(info, { quality: preferredFormat.itag }),
    fs.createWriteStream(localRawMediaPath),
  );

  return {
    localRawMediaPath,
    contentType: preferredFormat.mimeType ?? null,
    durationSec: Number(info.videoDetails.lengthSeconds || 0) || undefined,
  };
}

function isLikelyPlayableMedia(contentType: string | null, mediaKind: MediaCandidate['mediaKind']): boolean {
  if (!contentType) return false;
  const normalized = contentType.toLowerCase();
  if (normalized.includes('text/html')) return false;
  if (mediaKind === 'audio') return normalized.startsWith('audio/') || normalized.includes('octet-stream');
  if (mediaKind === 'video') return normalized.startsWith('video/') || normalized.includes('octet-stream');
  return false;
}

function shouldCollect(media: MediaCandidate): boolean {
  return media.mediaKind === 'audio' || media.mediaKind === 'video';
}

function isPlaceholderOrUnsupportedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      !['http:', 'https:'].includes(parsed.protocol) ||
      parsed.hostname === 'example.local' ||
      parsed.hostname.endsWith('.local')
    );
  } catch {
    return true;
  }
}

function existingFileLooksPlayable(filePath: string): boolean {
  if (!fs.existsSync(filePath)) return false;
  const header = fs.readFileSync(filePath).subarray(0, 64).toString('utf8').trimStart();
  return !header.startsWith('<!DOCTYPE') && !header.startsWith('<html') && !header.startsWith('<');
}

async function main() {
  loadLocalEnv(rootDir);
  parseArgs(process.argv.slice(2));
  requireEnv({
    required: ['EXA_API_KEY'],
  });
  const args = parseArgs(process.argv.slice(2));
  const caseId = args.caseId;
  if (!caseId) {
    throw new Error('Usage: npm run collect-audio-sources -- --caseId=<caseId>');
  }

  const bundle = loadCaseBundle(caseId);
  const rawDir = path.join(getCaseDir(caseId), 'assets', 'audio', 'raw');

  const media = await Promise.all(
    bundle.media.map(async (entry) => {
      if (!shouldCollect(entry)) return entry;
      if (isPlaceholderOrUnsupportedUrl(entry.url)) {
        return {
          ...entry,
          downloadStatus: 'failed' as const,
          voiceCloneEligibility: 'fallback_only' as const,
          rightsNotes: `${entry.rightsNotes ?? ''} Source URL is placeholder or unsupported for automated audio collection.`.trim(),
        };
      }
      if (
        entry.downloadStatus === 'downloaded' &&
        entry.localRawMediaPath &&
        existingFileLooksPlayable(entry.localRawMediaPath)
      ) {
        return entry;
      }

      const ext = fileExtensionFromUrl(entry.url, entry.mediaKind === 'audio' ? 'mp3' : 'mp4');
      const localRawMediaPath = path.join(rawDir, `${entry.mediaId}.${ext}`);

      try {
        if (isYouTubeUrl(entry.url)) {
          const resolved = await downloadYouTubeMedia({
            url: entry.url,
            targetPathWithoutExt: path.join(rawDir, entry.mediaId),
          });
          return {
            ...entry,
            localRawMediaPath: resolved.localRawMediaPath,
            localStoragePath: resolved.localRawMediaPath,
            downloadStatus: 'downloaded' as const,
            durationSec: resolved.durationSec ?? entry.durationSec,
            speechDurationSec: resolved.durationSec ?? entry.speechDurationSec,
            rightsNotes: `${entry.rightsNotes ?? ''} Downloaded via YouTube resolver.`.trim(),
          };
        }

        const { bytes, contentType } = await downloadFile(entry.url);
        if (!isLikelyPlayableMedia(contentType, entry.mediaKind)) {
          throw new Error(`Unsupported content-type for direct media download: ${contentType ?? 'unknown'}`);
        }
        writeBinaryFile(localRawMediaPath, bytes);
        return {
          ...entry,
          localRawMediaPath,
          localStoragePath: localRawMediaPath,
          downloadStatus: 'downloaded' as const,
        };
      } catch (error) {
        if (fs.existsSync(localRawMediaPath)) {
          fs.rmSync(localRawMediaPath, { force: true });
        }
        return {
          ...entry,
          localRawMediaPath: undefined,
          downloadStatus: 'failed' as const,
          rightsNotes: `${entry.rightsNotes ?? ''} Download failed: ${String(error)}`.trim(),
        };
      }
    }),
  );

  saveCaseBundle(caseId, { media });
  console.log(`Collected raw audio sources for ${caseId}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
