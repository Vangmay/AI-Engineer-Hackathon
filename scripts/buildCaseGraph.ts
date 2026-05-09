import type {
  CaseRecord,
  EvidenceItem,
  PersonRecord,
  TimelineEvent,
} from '../src/types/research.ts';
import { loadCaseBundle, saveCaseBundle } from './lib/caseFiles.ts';
import { parseArgs } from './lib/cli.ts';
import { loadLocalEnv, requireEnv } from './lib/env.ts';
import { rootDir } from './lib/paths.ts';
import { buildFallbackEvidence, buildFallbackTimeline } from './lib/pipeline.ts';
import { computePriorityScore } from './lib/scoring.ts';

function promotePrimaryCharacters(people: PersonRecord[]): PersonRecord[] {
  return [...people]
    .sort((a, b) => b.narrativeValueScore - a.narrativeValueScore)
    .map((person, index) => ({
      ...person,
      isPrimaryCharacter: person.roleType !== 'victim' && index < 4,
      voiceCloneCandidate: person.roleType !== 'victim' && index < 4,
      faceCloneCandidate: person.roleType !== 'victim' && index < 4,
    }));
}

function updateCaseScores(
  caseRecord: CaseRecord,
  people: PersonRecord[],
  timeline: TimelineEvent[],
  evidence: EvidenceItem[],
): CaseRecord {
  const castClarityScore = Math.min(100, 45 + people.filter((person) => person.isPrimaryCharacter).length * 10);
  const documentationScore = Math.min(100, caseRecord.documentationScore + timeline.length * 2);
  const mediaRichnessScore = Math.min(
    100,
    caseRecord.mediaRichnessScore + people.filter((person) => person.voiceCloneCandidate).length * 4,
  );

  return {
    ...caseRecord,
    castClarityScore,
    documentationScore,
    mediaRichnessScore,
    priorityScore: computePriorityScore(
      caseRecord.mysteryFitScore,
      documentationScore,
      mediaRichnessScore,
      castClarityScore,
    ),
    gameAdaptationStatus: evidence.length >= 3 ? 'in_progress' : caseRecord.gameAdaptationStatus,
    updatedAt: new Date().toISOString(),
  };
}

async function main() {
  loadLocalEnv(rootDir);
  parseArgs(process.argv.slice(2));
  requireEnv({
    required: ['OPENAI_API_KEY'],
    optional: ['OPENAI_MODEL'],
  });
  const args = parseArgs(process.argv.slice(2));
  const caseId = args.caseId;
  if (!caseId) {
    throw new Error('Usage: npm run build-case-graph -- --caseId=<caseId>');
  }

  const bundle = loadCaseBundle(caseId);
  if (!bundle.caseRecord.caseId) {
    throw new Error(`Case bundle "${caseId}" does not exist.`);
  }

  const people = promotePrimaryCharacters(bundle.people);
  const timeline = bundle.timeline.length
    ? bundle.timeline
    : buildFallbackTimeline(bundle.caseRecord, people, bundle.sources);
  const evidence = bundle.evidence.length
    ? bundle.evidence
    : buildFallbackEvidence(bundle.caseRecord, people, bundle.sources);
  const caseRecord = updateCaseScores(bundle.caseRecord, people, timeline, evidence);

  saveCaseBundle(caseId, {
    caseRecord,
    people,
    timeline,
    evidence,
  });

  console.log(`Built case graph for ${caseId}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
