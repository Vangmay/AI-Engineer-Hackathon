import type { MysteryCase, Witness } from '../../src/types/case.ts';
import type { GameCasePackage, WitnessPromptPack } from '../../src/types/gamePackage.ts';
import type { DerivedAsset, MediaCandidate } from '../../src/types/media.ts';
import type {
  CaseRecord,
  CandidateCaseRecord,
  EvidenceItem,
  PersonRoleType,
  PersonRecord,
  SourceRecord,
  TimelineEvent,
} from '../../src/types/research.ts';
import { writeTextFile } from './fs.ts';
import { createId, createCaseId, hashText } from './ids.ts';
import { computeCloneUsabilityScore, computePriorityScore } from './scoring.ts';

export function createCandidateFromExa(input: {
  querySet: string;
  query: string;
  result: {
    title: string;
    url: string;
    text?: string;
    publishedDate?: string;
    id?: string;
    score?: number;
  };
}): CandidateCaseRecord {
  const combinedText = `${input.result.title}\n${input.result.text ?? ''}`;
  const inferredCaseStatus = inferCaseStatus(combinedText);
  const priorityBucket = inferPriorityBucket(combinedText, inferredCaseStatus);

  const mysteryFitScore = scoreByKeywords(combinedText, [
    ['murder', 24],
    ['unsolved', 22],
    ['cold case', 20],
    ['witness', 16],
    ['detective', 12],
    ['timeline', 10],
  ]);
  const documentationScore = scoreByKeywords(combinedText, [
    ['court', 18],
    ['interview', 18],
    ['documentary', 14],
    ['evidence', 14],
    ['reported', 10],
    ['well documented', 18],
    ['investigation', 10],
    ['archive', 10],
  ]);
  const mediaRichnessScore = scoreByKeywords(combinedText, [
    ['video', 18],
    ['audio', 18],
    ['interview', 18],
    ['photo', 14],
    ['documentary', 14],
  ]);
  const castClarityScore = scoreByKeywords(combinedText, [
    ['suspect', 22],
    ['victim', 18],
    ['witness', 18],
    ['family', 12],
    ['investigator', 12],
  ]);
  const basePriorityScore = computePriorityScore(
    mysteryFitScore,
    documentationScore,
    mediaRichnessScore,
    castClarityScore,
  );
  const priorityScore = applyPriorityPolicy({
    inferredCaseStatus,
    priorityBucket,
    documentationScore,
    basePriorityScore,
    text: combinedText,
  });

  return {
    caseId: createCaseId(input.result.title, input.result.publishedDate),
    canonicalTitle: input.result.title,
    summaryShort: (input.result.text ?? '').slice(0, 280),
    querySet: input.querySet,
    query: input.query,
    priorityBucket,
    inferredCaseStatus,
    sourceUrl: input.result.url,
    sourceTitle: input.result.title,
    publishedDate: input.result.publishedDate,
    exaQueryId: input.result.id,
    mysteryFitScore,
    documentationScore,
    mediaRichnessScore,
    castClarityScore,
    priorityScore,
    createdAt: new Date().toISOString(),
    rawResult: input.result as Record<string, unknown>,
  };
}

function inferCaseStatus(text: string): CandidateCaseRecord['inferredCaseStatus'] {
  const normalized = text.toLowerCase();
  if (
    normalized.includes('unsolved') ||
    normalized.includes('cold case') ||
    normalized.includes('unresolved') ||
    normalized.includes('case remains open')
  ) {
    return 'unsolved';
  }
  if (
    normalized.includes('solved') ||
    normalized.includes('convicted') ||
    normalized.includes('found guilty') ||
    normalized.includes('sentenced') ||
    normalized.includes('confessed')
  ) {
    return 'solved';
  }
  if (normalized.includes('reopened')) return 'reopened';
  if (normalized.includes('disputed')) return 'disputed';
  return 'unknown';
}

function inferPriorityBucket(
  text: string,
  inferredCaseStatus: CandidateCaseRecord['inferredCaseStatus'],
): CandidateCaseRecord['priorityBucket'] {
  const normalized = text.toLowerCase();
  const hasConflictSignals =
    normalized.includes('conflicting') ||
    normalized.includes('contradiction') ||
    normalized.includes('disputed') ||
    normalized.includes('multiple theories') ||
    normalized.includes('controversy');
  const hasDocumentationSignals =
    normalized.includes('documentary') ||
    normalized.includes('interview') ||
    normalized.includes('court') ||
    normalized.includes('archive') ||
    normalized.includes('evidence');

  if (
    (inferredCaseStatus === 'unsolved' || inferredCaseStatus === 'cold_case') &&
    hasDocumentationSignals
  ) {
    return 'unsolved_documented';
  }
  if (inferredCaseStatus === 'solved' && hasConflictSignals) {
    return 'solved_conflict';
  }
  return 'general';
}

function applyPriorityPolicy(input: {
  inferredCaseStatus: CandidateCaseRecord['inferredCaseStatus'];
  priorityBucket: CandidateCaseRecord['priorityBucket'];
  documentationScore: number;
  basePriorityScore: number;
  text: string;
}): number {
  let adjusted = input.basePriorityScore;

  if (input.priorityBucket === 'unsolved_documented') {
    adjusted += 18;
    if (input.documentationScore >= 70) adjusted += 8;
  } else if (input.priorityBucket === 'solved_conflict') {
    adjusted += 10;
  } else if (input.inferredCaseStatus === 'solved') {
    adjusted -= 12;
  }

  const normalized = input.text.toLowerCase();
  if (
    normalized.includes('well documented') ||
    normalized.includes('extensive archive') ||
    normalized.includes('full documentary')
  ) {
    adjusted += 6;
  }

  return Math.max(0, Math.min(100, Math.round(adjusted)));
}

function scoreByKeywords(text: string | undefined, pairs: Array<[string, number]>): number {
  const normalized = (text ?? '').toLowerCase();
  const total = pairs.reduce((sum, [keyword, weight]) => {
    return sum + (normalized.includes(keyword) ? weight : 0);
  }, 18);
  return Math.max(0, Math.min(100, total));
}

export function inferSourceType(title: string, url: string): SourceRecord['sourceType'] {
  const haystack = `${title} ${url}`.toLowerCase();
  if (haystack.includes('court')) return 'court';
  if (haystack.includes('police')) return 'police';
  if (haystack.includes('podcast')) return 'podcast';
  if (haystack.includes('youtube') || haystack.includes('video')) return 'video';
  if (haystack.includes('documentary')) return 'documentary';
  if (haystack.includes('wiki')) return 'wiki';
  if (haystack.includes('archive')) return 'archive';
  if (haystack.includes('forum') || haystack.includes('reddit')) return 'forum';
  return 'news';
}

export function inferCredibilityTier(
  sourceType: SourceRecord['sourceType'],
): SourceRecord['credibilityTier'] {
  switch (sourceType) {
    case 'court':
    case 'police':
      return 'primary';
    case 'documentary':
    case 'interview':
    case 'news':
    case 'book':
      return 'strong_secondary';
    case 'archive':
    case 'video':
    case 'podcast':
    case 'wiki':
      return 'weak_secondary';
    default:
      return 'unverified';
  }
}

export function candidateToCaseRecord(candidate: CandidateCaseRecord): CaseRecord {
  const caseStatus: CaseRecord['caseStatus'] =
    candidate.inferredCaseStatus === 'unknown' ? 'unsolved' : candidate.inferredCaseStatus;

  return {
    caseId: candidate.caseId,
    canonicalTitle: candidate.canonicalTitle,
    aliases: [],
    caseStatus,
    jurisdictionCountry: 'Unknown',
    jurisdictionRegion: 'Unknown',
    primaryLanguage: 'en',
    summaryShort: candidate.summaryShort,
    summaryLong: candidate.summaryShort,
    mysteryFitScore: candidate.mysteryFitScore,
    documentationScore: candidate.documentationScore,
    sourceCount: 1,
    mediaRichnessScore: candidate.mediaRichnessScore,
    castClarityScore: candidate.castClarityScore,
    priorityScore: candidate.priorityScore,
    gameAdaptationStatus: 'not_started',
    assetGenerationStatus: 'not_started',
    tags: [candidate.querySet, candidate.priorityBucket],
    createdAt: candidate.createdAt,
    updatedAt: candidate.createdAt,
  };
}

export function makeSourceRecord(input: {
  caseId: string;
  exaQueryId?: string;
  title: string;
  url: string;
  text?: string;
  author?: string;
  publishedDate?: string;
}): SourceRecord {
  const sourceType = inferSourceType(input.title, input.url);
  return {
    sourceId: createId('source', `${input.caseId}:${input.url}`),
    caseId: input.caseId,
    sourceType,
    title: input.title,
    author: input.author,
    publicationDate: input.publishedDate,
    url: input.url,
    retrievedAt: new Date().toISOString(),
    excerpt: (input.text ?? '').slice(0, 500),
    credibilityTier: inferCredibilityTier(sourceType),
    exaQueryId: input.exaQueryId,
    dedupeHash: hashText(input.url),
    language: 'en',
  };
}

export function derivePeopleFromSources(caseRecord: CaseRecord, sources: SourceRecord[]): PersonRecord[] {
  const names = new Map<string, number>();
  const namePattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\b/gu;

  for (const source of sources) {
    const sample = source.excerpt;
    for (const match of sample.matchAll(namePattern)) {
      const name = match[1]?.trim();
      if (!name || name === caseRecord.canonicalTitle) continue;
      names.set(name, (names.get(name) ?? 0) + 1);
    }
  }

  const rankedNames = [...names.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map<PersonRecord>(([name], index) => {
      const roleType: PersonRoleType = index === 0 ? 'victim' : index === 1 ? 'suspect' : 'witness';
      return {
        personId: createId('person', `${caseRecord.caseId}:${name}`),
        caseId: caseRecord.caseId,
        fullName: name,
        aliases: [],
        roleType,
        isPrimaryCharacter: index < 4,
        isLiving: 'unknown',
        publicProfileLevel: 'medium',
        narrativeValueScore: Math.max(50, 84 - index * 7),
        suspicionScore: index === 1 ? 78 : Math.max(15, 52 - index * 9),
        documentationScore: Math.max(40, caseRecord.documentationScore - index * 5),
        mediaRichnessScore: Math.max(35, caseRecord.mediaRichnessScore - index * 4),
        voiceCloneCandidate: index < 3,
        faceCloneCandidate: index < 3,
        identityUseMode: 'real',
        shortBio:
          index === 0 ? 'Primary named figure in case coverage.' : 'Named in source coverage.',
      };
    });

  return rankedNames;
}

export function buildFallbackTimeline(
  caseRecord: CaseRecord,
  people: PersonRecord[],
  sources: SourceRecord[],
): TimelineEvent[] {
  return sources.slice(0, 5).map((source, index) => ({
    eventId: createId('event', `${caseRecord.caseId}:${source.sourceId}:${index}`),
    caseId: caseRecord.caseId,
    timestampPrecision: source.publicationDate ? 'day' : 'unknown',
    timestampStart: source.publicationDate,
    eventType: index === 0 ? 'crime' : index === 4 ? 'media_report' : 'witness_statement',
    description: source.excerpt || source.title,
    peopleInvolved: people.slice(0, Math.max(1, Math.min(3, people.length))).map((person) => person.personId),
    locationLabel: caseRecord.primaryLocationLabel,
    sourceIds: [source.sourceId],
    confidenceScore: Math.max(55, 90 - index * 6),
  }));
}

export function buildFallbackEvidence(
  caseRecord: CaseRecord,
  people: PersonRecord[],
  sources: SourceRecord[],
): EvidenceItem[] {
  return sources.slice(0, 4).map((source, index) => ({
    evidenceId: createId('evidence', `${caseRecord.caseId}:${source.sourceId}`),
    caseId: caseRecord.caseId,
    label: `Lead ${index + 1}`,
    evidenceType: index === 0 ? 'testimonial' : index === 1 ? 'document' : 'digital',
    description: source.excerpt || source.title,
    supports: people[1] ? [people[1].personId] : [],
    contradicts: index === 3 && people[2] ? [people[2].personId] : [],
    isPubliclyDocumented: true,
    gameplayValue: index === 3 ? 'red_herring' : index < 2 ? 'core_clue' : 'secondary_clue',
    sourceIds: [source.sourceId],
    confidenceScore: Math.max(50, 84 - index * 7),
  }));
}

export function buildMediaCandidates(
  caseRecord: CaseRecord,
  people: PersonRecord[],
  sources: SourceRecord[],
  maxPerPerson: number,
): MediaCandidate[] {
  return people
    .filter((person) => person.isPrimaryCharacter)
    .flatMap((person) =>
      sources.slice(0, maxPerPerson).map((source, index) => {
        const mediaKind: MediaCandidate['mediaKind'] =
          index % 3 === 0 ? 'video' : index % 3 === 1 ? 'image' : 'audio';
        const signalQuality = mediaKind === 'image' ? 82 : 70;
        const personCertainty = 78 - index;
        const transcriptRichness = source.excerpt.length > 140 ? 72 : 48;
        const sourceCredibility = source.credibilityTier === 'primary' ? 90 : 68;
        return {
          mediaId: createId('media', `${person.personId}:${source.sourceId}:${index}`),
          caseId: caseRecord.caseId,
          personId: person.personId,
          mediaKind,
          originType: mediaKind === 'image' ? 'archive_photo' : 'interview',
          url: source.url,
          transcriptAvailable: mediaKind !== 'image',
          containsTargetPerson: true,
          faceVisibilityScore: mediaKind === 'image' ? 88 : 70,
          voiceIsolatedScore: mediaKind === 'audio' || mediaKind === 'video' ? 72 : 0,
          backgroundNoiseScore: mediaKind === 'audio' || mediaKind === 'video' ? 26 : 0,
          usableForCloneScore: computeCloneUsabilityScore({
            signalQuality,
            personCertainty,
            transcriptRichness,
            sourceCredibility,
          }),
          sourceIds: [source.sourceId],
          extractedAt: new Date().toISOString(),
          durationSec: mediaKind === 'image' ? undefined : 110 + index * 15,
        } satisfies MediaCandidate;
      }),
    );
}

export function chooseTruthWitness(people: PersonRecord[]): PersonRecord | undefined {
  return [...people]
    .filter((person) => person.isPrimaryCharacter)
    .sort((a, b) => b.suspicionScore - a.suspicionScore)[0];
}

export function buildRuntimeCase(input: {
  caseRecord: CaseRecord;
  people: PersonRecord[];
  evidence: EvidenceItem[];
  timeline: TimelineEvent[];
}): MysteryCase {
  const victim =
    input.people.find((person) => person.roleType === 'victim') ??
    input.people[0] ?? {
      fullName: 'Unknown Victim',
      shortBio: 'Unknown occupation',
    };
  const witnessesSource = input.people
    .filter((person) => person.isPrimaryCharacter && person.roleType !== 'victim')
    .slice(0, 5);
  const killer = chooseTruthWitness(witnessesSource);

  const witnesses: Witness[] = witnessesSource.map((person, index) => ({
    id: person.personId,
    name: person.fullName,
    role: person.roleType === 'suspect' ? 'Primary suspect' : person.shortBio,
    age: person.birthYear ? new Date().getUTCFullYear() - person.birthYear : 40 - index,
    knows:
      input.timeline[index]?.description ??
      `Knows key details about ${input.caseRecord.canonicalTitle}.`,
    hiding:
      person.notes ??
      (person.personId === killer?.personId
        ? 'Is hiding the strongest contradiction in the case timeline.'
        : 'Is withholding a damaging but not decisive detail.'),
    lies: person.personId === killer?.personId,
    voice_id: '',
    portrait_prompt: `${person.fullName}, documentary portrait, realistic, editorial true crime style`,
  }));

  return {
    case_id: input.caseRecord.caseId,
    title: input.caseRecord.canonicalTitle,
    victim: {
      name: victim.fullName,
      age: victim.birthYear ? new Date().getUTCFullYear() - victim.birthYear : 45,
      occupation: victim.shortBio,
      time_of_death: 'Unknown',
      location: input.caseRecord.primaryLocationLabel ?? 'Unknown location',
      date: input.caseRecord.incidentStartDate ?? input.caseRecord.createdAt.slice(0, 10),
    },
    truth: {
      killer: killer?.personId ?? witnesses[0]?.id ?? 'unknown',
      motive:
        killer?.notes ??
        'The case package inferred motive from the strongest combination of timeline pressure and contradictory statements.',
      method: input.evidence[0]?.description ?? 'Method still under reconstruction.',
      hidden_clue:
        input.evidence.find((item) => item.gameplayValue === 'core_clue')?.description ??
        'No hidden clue derived yet.',
    },
    witnesses,
    clues: input.evidence.slice(0, 4).map((item) => item.description),
    scene_prompt: `Investigative scene reconstruction of ${input.caseRecord.canonicalTitle}, grounded in documented evidence and timeline details.`,
    brief: input.caseRecord.summaryShort,
  };
}

export function buildWitnessPromptPacks(
  runtimeCase: MysteryCase,
  people: PersonRecord[],
): WitnessPromptPack[] {
  return runtimeCase.witnesses.map((witness) => {
    const person = people.find((entry) => entry.personId === witness.id);
    return {
      witnessId: witness.id,
      systemPrompt: `You are ${witness.name}. Stay grounded in documented case facts, answer in character, and do not reveal the hidden truth outright.`,
      openingLine: `I'm ${witness.name}. What do you want to know about that night?`,
      truthsTheyKnow: [witness.knows],
      secretsTheyHide: [witness.hiding],
      lieStrategy: witness.lies
        ? 'Deflect blame, narrow your time window, and answer only what was asked.'
        : person?.notes,
    };
  });
}

export function buildGameCasePackage(input: {
  caseRecord: CaseRecord;
  people: PersonRecord[];
  timeline: TimelineEvent[];
  evidence: EvidenceItem[];
  derivedAssets: DerivedAsset[];
}): GameCasePackage {
  const runtimeCase = buildRuntimeCase(input);
  const witnessPromptPacks = buildWitnessPromptPacks(runtimeCase, input.people);
  const witnessPortraits = Object.fromEntries(
    runtimeCase.witnesses.map((witness) => {
      const portrait = input.derivedAssets.find(
        (asset) => asset.personId === witness.id && asset.assetType === 'portrait',
      );
      return [witness.id, portrait?.outputUri ?? ''];
    }),
  );
  const witnessVoiceSamples = Object.fromEntries(
    runtimeCase.witnesses.map((witness) => {
      const voice = input.derivedAssets.find(
        (asset) => asset.personId === witness.id && asset.assetType === 'voice_line',
      );
      return [witness.id, voice?.outputUri ?? ''];
    }),
  );

  return {
    packageId: createId('pkg', `${input.caseRecord.caseId}:${new Date().toISOString()}`),
    caseId: input.caseRecord.caseId,
    title: input.caseRecord.canonicalTitle,
    runtimeCase,
    witnessPromptPacks,
    call911Script: `Emergency dispatch, please respond to ${runtimeCase.victim.location}. ${runtimeCase.victim.name} has been found unresponsive and witnesses are giving conflicting accounts.`,
    revealNarrationText: `The reconstructed truth points to ${runtimeCase.truth.killer}. ${runtimeCase.truth.motive} ${runtimeCase.truth.method}`,
    assetManifest: {
      sceneImageUri: input.derivedAssets.find((asset) => asset.assetType === 'case_image')?.outputUri,
      call911AudioUri: input.derivedAssets.find((asset) => asset.assetType === 'voice_line')?.outputUri,
      revealNarrationAudioUri: input.derivedAssets.find((asset) => asset.assetType === 'ambient_audio')?.outputUri,
      witnessPortraits,
      witnessVoiceSamples,
    },
    packageVersion: '1.0.0',
    generatedAt: new Date().toISOString(),
  };
}

export function writeAssetPlaceholder(filePath: string, contents: string): void {
  writeTextFile(filePath, contents);
}
