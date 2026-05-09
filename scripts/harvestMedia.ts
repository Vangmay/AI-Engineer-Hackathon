import type { MediaCandidate } from '../src/types/media.ts';
import { loadCaseBundle, saveCaseBundle } from './lib/caseFiles.ts';
import { parseArgs } from './lib/cli.ts';
import { loadLocalEnv, requireEnv } from './lib/env.ts';
import { rootDir } from './lib/paths.ts';
import { buildMediaCandidates } from './lib/pipeline.ts';

function dedupeMedia(media: MediaCandidate[]): MediaCandidate[] {
  return media.filter(
    (entry, index, all) =>
      all.findIndex(
        (candidate) =>
          candidate.personId === entry.personId &&
          candidate.url === entry.url &&
          candidate.mediaKind === entry.mediaKind,
      ) === index,
  );
}

async function main() {
  loadLocalEnv(rootDir);
  const args = parseArgs(process.argv.slice(2));
  const env = requireEnv({
    required: ['EXA_API_KEY', 'OPENAI_API_KEY'],
    optional: ['MEDIA_PER_PERSON_LIMIT', 'OPENAI_MODEL'],
  });
  const caseId = args.caseId;
  if (!caseId) {
    throw new Error('Usage: npm run harvest-media -- --caseId=<caseId>');
  }

  const bundle = loadCaseBundle(caseId);
  if (!bundle.caseRecord.caseId) {
    throw new Error(`Case bundle "${caseId}" does not exist.`);
  }

  const generated = buildMediaCandidates(
    bundle.caseRecord,
    bundle.people,
    bundle.sources,
    Number(args.limit ?? env.MEDIA_PER_PERSON_LIMIT ?? '12'),
  );
  const media = dedupeMedia([...bundle.media, ...generated]);

  saveCaseBundle(caseId, {
    media,
    caseRecord: {
      ...bundle.caseRecord,
      assetGenerationStatus: media.length > 0 ? 'queued' : bundle.caseRecord.assetGenerationStatus,
      updatedAt: new Date().toISOString(),
    },
  });

  console.log(`Harvested ${media.length} media candidates for ${caseId}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
