import path from 'node:path';
import fs from 'node:fs';
import type { CandidateCaseRecord, SourceRecord } from '../src/types/research.ts';
import { loadCaseBundle, saveCaseBundle } from './lib/caseFiles.ts';
import { parseArgs } from './lib/cli.ts';
import { loadLocalEnv, requireEnv } from './lib/env.ts';
import { searchExa } from './lib/exa.ts';
import { indexDir, rootDir } from './lib/paths.ts';
import { candidateToCaseRecord, derivePeopleFromSources, makeSourceRecord } from './lib/pipeline.ts';

function loadCandidatesFromJsonl(): CandidateCaseRecord[] {
  const indexPath = path.join(indexDir, 'candidate-cases.jsonl');
  if (!fs.existsSync(indexPath)) return [];
  const raw = fs.readFileSync(indexPath, 'utf8');
  return raw
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as CandidateCaseRecord);
}

async function main() {
  loadLocalEnv(rootDir);
  const args = parseArgs(process.argv.slice(2));
  const env = requireEnv({
    required: ['EXA_API_KEY', 'OPENAI_API_KEY'],
    optional: ['SOURCE_FETCH_LIMIT', 'OPENAI_MODEL'],
  });
  const caseId = args.caseId;
  if (!caseId) {
    throw new Error('Usage: npm run ingest-sources -- --caseId=<caseId>');
  }

  const candidates = loadCandidatesFromJsonl();
  const candidate = candidates.find((entry) => entry.caseId === caseId);
  if (!candidate) {
    throw new Error(`Candidate case "${caseId}" was not found in data/index/candidate-cases.jsonl`);
  }

  const search = await searchExa({
    apiKey: env.EXA_API_KEY!,
    query: `${candidate.canonicalTitle} case timeline suspect witness documentary interview`,
    numResults: Number(args.limit ?? env.SOURCE_FETCH_LIMIT ?? '15'),
    includeText: true,
  });

  const sourceRecords: SourceRecord[] = [
    makeSourceRecord({
      caseId,
      exaQueryId: candidate.exaQueryId,
      title: candidate.sourceTitle,
      url: candidate.sourceUrl,
      text: candidate.summaryShort,
      publishedDate: candidate.publishedDate,
    }),
    ...search.results.map((result) =>
      makeSourceRecord({
        caseId,
        exaQueryId: search.requestId,
        title: result.title,
        url: result.url,
        text: result.text,
        author: result.author,
        publishedDate: result.publishedDate,
      }),
    ),
  ].filter((source, index, all) => all.findIndex((entry) => entry.dedupeHash === source.dedupeHash) === index);

  const caseRecord = candidateToCaseRecord(candidate);
  caseRecord.sourceCount = sourceRecords.length;
  caseRecord.summaryLong = sourceRecords.map((source) => source.excerpt).join('\n\n').slice(0, 4000);
  caseRecord.updatedAt = new Date().toISOString();
  const people = derivePeopleFromSources(caseRecord, sourceRecords);

  const existing = loadCaseBundle(caseId);
  saveCaseBundle(caseId, {
    caseRecord: existing.caseRecord.caseId ? { ...existing.caseRecord, ...caseRecord } : caseRecord,
    sources: sourceRecords,
    people,
  });

  console.log(`Ingested ${sourceRecords.length} sources for ${caseId}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
