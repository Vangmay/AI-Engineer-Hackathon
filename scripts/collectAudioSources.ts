import path from 'node:path';
import fs from 'node:fs';
import type { MediaCandidate } from '../src/types/media.ts';
import { loadCaseBundle, saveCaseBundle, getCaseDir } from './lib/caseFiles.ts';
import { parseArgs } from './lib/cli.ts';
import { loadLocalEnv, requireEnv } from './lib/env.ts';
import { writeBinaryFile } from './lib/fs.ts';
import { fileExtensionFromUrl } from './lib/ids.ts';
import { rootDir } from './lib/paths.ts';

async function downloadFile(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Download failed: ${response.status} ${response.statusText}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

function shouldCollect(media: MediaCandidate): boolean {
  return media.mediaKind === 'audio' || media.mediaKind === 'video';
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
      if (entry.downloadStatus === 'downloaded' && entry.localRawMediaPath && fs.existsSync(entry.localRawMediaPath)) {
        return entry;
      }

      const ext = fileExtensionFromUrl(entry.url, entry.mediaKind === 'audio' ? 'mp3' : 'mp4');
      const localRawMediaPath = path.join(rawDir, `${entry.mediaId}.${ext}`);

      try {
        const bytes = await downloadFile(entry.url);
        writeBinaryFile(localRawMediaPath, bytes);
        return {
          ...entry,
          localRawMediaPath,
          localStoragePath: localRawMediaPath,
          downloadStatus: 'downloaded' as const,
        };
      } catch (error) {
        return {
          ...entry,
          localRawMediaPath,
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
