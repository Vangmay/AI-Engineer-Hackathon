import path from 'node:path';
import { ensureDir, writeJsonl } from './lib/fs.ts';
import { parseArgs } from './lib/cli.ts';
import { loadLocalEnv, requireEnv } from './lib/env.ts';
import { searchExa } from './lib/exa.ts';
import { createCandidateFromExa } from './lib/pipeline.ts';
import { indexDir, rootDir } from './lib/paths.ts';
import type { CandidateCaseRecord } from '../src/types/research.ts';

const QUERY_SETS: Record<string, string[]> = {
  'global-cold-cases': [
    'well documented unsolved murder case documentary interview witness audio archive',
    'cold case with strong documentation suspect interview timeline evidence archive footage',
    'unsolved homicide case documentary court records witness interviews',
    'solved murder case with conflicting accounts disputed timeline documentary interviews',
    'solved homicide case controversy conflicting witness statements documentary',
  ],
};

async function main() {
  loadLocalEnv(rootDir);
  const args = parseArgs(process.argv.slice(2));
  const env = requireEnv({
    required: ['EXA_API_KEY'],
    optional: ['CASE_DISCOVERY_MAX_RESULTS'],
  });
  const querySet = args.querySet ?? 'global-cold-cases';
  const limit = Number(args.limit ?? env.CASE_DISCOVERY_MAX_RESULTS ?? '50');
  const queries = QUERY_SETS[querySet];

  if (!queries) {
    throw new Error(`Unknown querySet "${querySet}". Available: ${Object.keys(QUERY_SETS).join(', ')}`);
  }

  ensureDir(indexDir);
  const outputPath = path.join(indexDir, 'candidate-cases.jsonl');
  const candidates: CandidateCaseRecord[] = [];

  for (const query of queries) {
    const exaResponse = await searchExa({
      apiKey: env.EXA_API_KEY!,
      query,
      numResults: Math.max(1, Math.ceil(limit / queries.length)),
      includeText: true,
    });

    for (const result of exaResponse.results) {
      candidates.push(
        createCandidateFromExa({
          querySet,
          query,
          result: {
            ...result,
            id: exaResponse.requestId ?? result.id,
          },
        }),
      );
    }
  }

  const deduped = candidates.filter(
    (candidate, index, all) =>
      all.findIndex((entry) => entry.sourceUrl === candidate.sourceUrl) === index,
  );

  const sorted = deduped.sort((a, b) => {
    const bucketRank = (candidate: CandidateCaseRecord) => {
      switch (candidate.priorityBucket) {
        case 'unsolved_documented':
          return 0;
        case 'solved_conflict':
          return 1;
        default:
          return 2;
      }
    };

    return (
      bucketRank(a) - bucketRank(b) ||
      b.priorityScore - a.priorityScore ||
      b.documentationScore - a.documentationScore ||
      b.mysteryFitScore - a.mysteryFitScore
    );
  });

  writeJsonl(outputPath, sorted);
  console.log(`Seeded candidate cases in ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
