import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { MediaCandidate } from '../src/types/media.ts';
import { loadCaseBundle, saveCaseBundle, getCaseDir } from './lib/caseFiles.ts';
import { parseArgs } from './lib/cli.ts';
import { loadLocalEnv, requireEnv } from './lib/env.ts';
import { writeBinaryFile } from './lib/fs.ts';
import { fileExtensionFromUrl } from './lib/ids.ts';
import { rootDir } from './lib/paths.ts';
import {
  scoreMediaUrlExtractionFitness,
  shouldAvoidDownloaderAttempts,
} from './lib/mediaCandidateUrlQuality.ts';

const execFileAsync = promisify(execFile);
const YT_DLP_BIN = '/opt/homebrew/bin/yt-dlp';

function expandHomePath(candidate: string): string {
  const trimmed = candidate.trim();
  if (trimmed === '~') return os.homedir();
  if (trimmed.startsWith(`~/`) || trimmed.startsWith(`~\\`)) {
    return path.join(os.homedir(), trimmed.slice(2));
  }
  return trimmed;
}

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

function isHostedMediaUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./u, '').toLowerCase();
    return (
      ['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be'].includes(host) ||
      host.endsWith('.youtube.com') ||
      ['podcasts.apple.com', 'open.spotify.com', 'music.amazon.com'].some((h) => host === h || host.endsWith(`.${h}`)) ||
      host.endsWith('primevideo.com') ||
      host.endsWith('vimeo.com') ||
      host.endsWith('dailymotion.com') ||
      host.endsWith('soundcloud.com') ||
      host.endsWith('twitch.tv') ||
      host.endsWith('bbc.co.uk') ||
      host.endsWith('cbc.ca')
    );
  } catch {
    return false;
  }
}

function existingFileLooksPlayable(filePath: string): boolean {
  if (!fs.existsSync(filePath)) return false;
  const header = fs.readFileSync(filePath).subarray(0, 64).toString('utf8').trimStart();
  return !header.startsWith('<!DOCTYPE') && !header.startsWith('<html') && !header.startsWith('<');
}

function isLikelyPlayableMedia(contentType: string | null, mediaKind: MediaCandidate['mediaKind']): boolean {
  if (!contentType) return false;
  const normalized = contentType.toLowerCase();
  if (normalized.includes('text/html')) return false;
  if (mediaKind === 'audio') return normalized.startsWith('audio/') || normalized.includes('octet-stream');
  if (mediaKind === 'video') return normalized.startsWith('video/') || normalized.includes('octet-stream');
  return false;
}

async function resolveHostedMedia(input: {
  url: string;
  outputTemplate: string;
}): Promise<{ localRawMediaPath: string; durationSec?: number }> {
  const args = [
    '--no-playlist',
    '--no-progress',
    '--no-warnings',
    '--restrict-filenames',
    '-f',
    'bestaudio/best',
    '-o',
    input.outputTemplate,
    '--print',
    'after_move:filepath',
    '--print',
    'duration',
  ];

  const cookiesFile = process.env.YT_DLP_COOKIES_FILE?.trim();
  if (cookiesFile) {
    args.push('--cookies', expandHomePath(cookiesFile));
  }
  const cookiesFromBrowser = process.env.YT_DLP_COOKIES_FROM_BROWSER?.trim();
  if (cookiesFromBrowser) {
    args.push('--cookies-from-browser', cookiesFromBrowser);
  }

  args.push(input.url);

  const { stdout } = await execFileAsync(YT_DLP_BIN, args, { maxBuffer: 1024 * 1024 * 10 });
  const lines = stdout
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
  const localRawMediaPath = lines.find((line) => line.startsWith('/'));
  if (!localRawMediaPath || !fs.existsSync(localRawMediaPath)) {
    throw new Error('yt-dlp did not produce a playable output file');
  }
  const durationLine = [...lines].reverse().find((line) => /^[0-9]+(?:\.[0-9]+)?$/u.test(line));
  return {
    localRawMediaPath,
    durationSec: durationLine ? Math.round(Number(durationLine)) : undefined,
  };
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

      const fitness = scoreMediaUrlExtractionFitness({
        url: entry.url,
        textSnippet: [entry.rightsNotes, entry.extractionFitnessNotes].filter(Boolean).join('\n').slice(0, 2400),
        bundledSources: bundle.sources,
      });

      if (shouldAvoidDownloaderAttempts(fitness)) {
        return {
          ...entry,
          extractionFitnessScore: fitness.score,
          extractionFitnessTier: fitness.tier,
          extractionFitnessNotes: fitness.notes.join(' · '),
          downloadStatus: 'failed' as const,
          voiceCloneEligibility: 'fallback_only' as const,
          rightsNotes: `${entry.rightsNotes ?? ''} Pre-download heuristic skip (${fitness.tier}, fitness ${fitness.score}): ${fitness.notes.join('; ')}`.trim(),
        };
      }

      const ext = fileExtensionFromUrl(entry.url, entry.mediaKind === 'audio' ? 'mp3' : 'mp4');
      const localRawMediaPath = path.join(rawDir, `${entry.mediaId}.${ext}`);

      try {
        if (isHostedMediaUrl(entry.url)) {
          const resolved = await resolveHostedMedia({
            url: entry.url,
            outputTemplate: path.join(rawDir, `${entry.mediaId}.%(ext)s`),
          });
          return {
            ...entry,
            localRawMediaPath: resolved.localRawMediaPath,
            localStoragePath: resolved.localRawMediaPath,
            downloadStatus: 'downloaded' as const,
            durationSec: resolved.durationSec ?? entry.durationSec,
            speechDurationSec: resolved.durationSec ?? entry.speechDurationSec,
            rightsNotes: `${entry.rightsNotes ?? ''} Downloaded via yt-dlp.`.trim(),
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
          localStoragePath: undefined,
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
