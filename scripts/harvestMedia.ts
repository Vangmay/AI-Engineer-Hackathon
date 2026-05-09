import type { MediaCandidate } from '../src/types/media.ts';
import { loadCaseBundle, saveCaseBundle } from './lib/caseFiles.ts';
import { parseArgs } from './lib/cli.ts';
import { loadLocalEnv, requireEnv } from './lib/env.ts';
import { searchExa } from './lib/exa.ts';
import { rootDir } from './lib/paths.ts';
import {
  buildMediaCandidates,
  buildMediaCandidatesFromSearch,
  inferClipRole,
} from './lib/pipeline.ts';

function mediaKey(entry: MediaCandidate): string {
  return `${entry.personId ?? 'none'}::${entry.mediaKind}::${entry.url}`;
}

function mergeMedia(existing: MediaCandidate[], generated: MediaCandidate[]): MediaCandidate[] {
  const merged = new Map<string, MediaCandidate>();

  for (const entry of generated) {
    merged.set(mediaKey(entry), entry);
  }

  for (const entry of existing) {
    const key = mediaKey(entry);
    const prior = merged.get(key);
    if (!prior) {
      merged.set(key, entry);
      continue;
    }

    merged.set(key, {
      ...prior,
      ...entry,
      sourceIds: prior.sourceIds.length > 0 ? prior.sourceIds : entry.sourceIds,
      rightsNotes: [prior.rightsNotes, entry.rightsNotes].filter(Boolean).join(' ').trim() || undefined,
      downloadStatus: entry.downloadStatus === 'downloaded' ? entry.downloadStatus : prior.downloadStatus,
      localRawMediaPath: entry.localRawMediaPath ?? prior.localRawMediaPath,
      localStoragePath: entry.localStoragePath ?? prior.localStoragePath,
      localAudioExtractPath: entry.localAudioExtractPath ?? prior.localAudioExtractPath,
    });
  }

  return [...merged.values()];
}

function buildMediaQueries(caseTitle: string, personName: string): string[] {
  const strippedTitle = caseTitle
    .replace(/^[^:]+:\s*/u, '')
    .replace(/[|].*$/u, '')
    .trim();

  return [
    `"${personName}" interview audio video documentary podcast`,
    `"${personName}" "${strippedTitle}" interview OR video OR podcast`,
    `"${personName}" "${strippedTitle}" family interview news video`,
  ];
}

async function pause(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
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

  const maxPerPerson = Number(args.limit ?? env.MEDIA_PER_PERSON_LIMIT ?? '12');
  const primaryPeople = bundle.people.filter((person) => person.isPrimaryCharacter);
  const activePersonIds = new Set(bundle.people.map((person) => person.personId));
  const searchResultsByPerson: Record<string, Awaited<ReturnType<typeof searchExa>>['results']> = {};
  for (const person of primaryPeople) {
    const queryResults = [];
    for (const query of buildMediaQueries(bundle.caseRecord.canonicalTitle, person.fullName)) {
      queryResults.push(
        await searchExa({
          apiKey: env.EXA_API_KEY!,
          query,
          numResults: Math.max(4, Math.ceil(maxPerPerson / 2)),
          includeText: true,
        }),
      );
      await pause(250);
    }

    searchResultsByPerson[person.personId] = queryResults
      .flatMap((result) => result.results)
      .filter(
        (result, index, all) => all.findIndex((candidate) => candidate.url === result.url) === index,
      )
      .slice(0, maxPerPerson);
  }
  const generatedFromSearch = buildMediaCandidatesFromSearch({
    caseRecord: bundle.caseRecord,
    people: bundle.people,
    sources: bundle.sources,
    searchResultsByPerson,
  });
  const generatedFallback =
    generatedFromSearch.length > 0
      ? []
      : buildMediaCandidates(bundle.caseRecord, bundle.people, bundle.sources, maxPerPerson);
  const normalizedExisting = bundle.media
    .filter(
      (entry) =>
        (!entry.personId || activePersonIds.has(entry.personId)) &&
        !entry.localAudioExtractPath,
    )
    .map((entry) => ({
      ...entry,
      downloadStatus: entry.downloadStatus ?? 'not_downloaded',
      transcriptSource: entry.transcriptSource ?? (entry.transcriptAvailable ? 'source_text' : 'none'),
      clipRole:
        entry.clipRole ??
        inferClipRole(
          bundle.people.find((person) => person.personId === entry.personId)?.roleType ?? 'other',
        ),
      voiceCloneEligibility:
        entry.voiceCloneEligibility ??
        (entry.mediaKind === 'image' ? 'fallback_only' : 'fallback_only'),
    }));
  const media = mergeMedia(normalizedExisting, [...generatedFromSearch, ...generatedFallback]);

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
