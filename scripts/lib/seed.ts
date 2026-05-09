import type { MysteryCase } from '../../src/types/case.ts';
import type { GameCasePackage } from '../../src/types/gamePackage.ts';
import type { DerivedAsset, MediaCandidate, ReviewRecord } from '../../src/types/media.ts';
import type {
  CaseRecord,
  EvidenceItem,
  PersonRecord,
  SourceRecord,
  TimelineEvent,
} from '../../src/types/research.ts';
import { raymondTeoCase } from '../../src/data/raymondTeoCase.ts';
import { createId } from './ids.ts';
import { computePriorityScore } from './scoring.ts';

const seededAt = '2026-05-09T00:00:00.000Z';

export function createSeedCaseRecord(runtimeCase: MysteryCase): CaseRecord {
  const mysteryFitScore = 84;
  const documentationScore = 68;
  const mediaRichnessScore = 61;
  const castClarityScore = 86;

  return {
    caseId: 'case_raymond_teo_2026',
    canonicalTitle: runtimeCase.title,
    aliases: ['Raymond Teo penthouse death'],
    caseStatus: 'unsolved',
    jurisdictionCountry: 'Singapore',
    jurisdictionRegion: 'Singapore',
    primaryLanguage: 'en',
    incidentStartDate: runtimeCase.victim.date,
    incidentEndDate: runtimeCase.victim.date,
    summaryShort: runtimeCase.brief,
    summaryLong: `${runtimeCase.brief} ${runtimeCase.truth.motive}`,
    mysteryFitScore,
    documentationScore,
    sourceCount: 3,
    mediaRichnessScore,
    castClarityScore,
    priorityScore: computePriorityScore(
      mysteryFitScore,
      documentationScore,
      mediaRichnessScore,
      castClarityScore,
    ),
    gameAdaptationStatus: 'adapted',
    assetGenerationStatus: 'reviewed',
    primaryLocationLabel: runtimeCase.victim.location,
    tags: ['seed', 'demo', 'penthouse'],
    createdAt: seededAt,
    updatedAt: seededAt,
  };
}

export function createSeedPeople(runtimeCase: MysteryCase): PersonRecord[] {
  const victim: PersonRecord = {
    personId: 'person_raymond_teo',
    caseId: 'case_raymond_teo_2026',
    fullName: runtimeCase.victim.name,
    aliases: [],
    roleType: 'victim',
    isPrimaryCharacter: false,
    isLiving: 'no',
    birthYear: 1979,
    nationality: 'Singaporean',
    publicProfileLevel: 'medium',
    narrativeValueScore: 78,
    suspicionScore: 0,
    documentationScore: 66,
    mediaRichnessScore: 52,
    voiceCloneCandidate: false,
    faceCloneCandidate: false,
    identityUseMode: 'real',
    shortBio: runtimeCase.victim.occupation,
  };

  const witnessPeople = runtimeCase.witnesses.map<PersonRecord>((witness, index) => ({
    personId: `person_${witness.id}`,
    caseId: 'case_raymond_teo_2026',
    fullName: witness.name,
    aliases: [],
    roleType: witness.lies ? 'suspect' : 'witness',
    isPrimaryCharacter: true,
    isLiving: 'yes',
    nationality: 'Singaporean',
    publicProfileLevel: 'medium',
    narrativeValueScore: 80 - index * 3,
    suspicionScore: witness.lies ? 88 : 42 - index * 8,
    documentationScore: 62,
    mediaRichnessScore: 55,
    voiceCloneCandidate: true,
    faceCloneCandidate: true,
    identityUseMode: 'real',
    shortBio: witness.role,
    notes: witness.hiding,
  }));

  return [victim, ...witnessPeople];
}

export function createSeedTimeline(runtimeCase: MysteryCase): TimelineEvent[] {
  return [
    {
      eventId: createId('event', 'audit_warning'),
      caseId: 'case_raymond_teo_2026',
      timestampPrecision: 'day',
      timestampStart: runtimeCase.victim.date,
      eventType: 'media_report',
      description: 'Raymond prepares to address unauthorized wire transfers and a staffing issue.',
      peopleInvolved: ['person_raymond_teo', 'person_w_priya'],
      locationLabel: runtimeCase.victim.location,
      sourceIds: ['source_seed_brief'],
      confidenceScore: 77,
    },
    {
      eventId: createId('event', 'tod'),
      caseId: 'case_raymond_teo_2026',
      timestampPrecision: 'exact',
      timestampStart: `${runtimeCase.victim.date}T${runtimeCase.victim.time_of_death}:00+08:00`,
      eventType: 'crime',
      description: runtimeCase.truth.method,
      peopleInvolved: ['person_raymond_teo', 'person_w_priya'],
      locationLabel: runtimeCase.victim.location,
      sourceIds: ['source_seed_brief'],
      confidenceScore: 93,
    },
    {
      eventId: createId('event', 'door_log'),
      caseId: 'case_raymond_teo_2026',
      timestampPrecision: 'exact',
      timestampStart: `${runtimeCase.victim.date}T02:51:00+08:00`,
      eventType: 'police_action',
      description: 'Penthouse access log shows the door opened from the inside shortly after the estimated time of death.',
      peopleInvolved: ['person_w_priya'],
      locationLabel: runtimeCase.victim.location,
      sourceIds: ['source_seed_access_log'],
      confidenceScore: 85,
    },
    {
      eventId: createId('event', 'lobby_exit'),
      caseId: 'case_raymond_teo_2026',
      timestampPrecision: 'exact',
      timestampStart: `${runtimeCase.victim.date}T03:12:00+08:00`,
      eventType: 'witness_statement',
      description: 'Marcus reports that Priya left the lobby later than usual.',
      peopleInvolved: ['person_w_marcus', 'person_w_priya'],
      locationLabel: 'Marina One lobby',
      sourceIds: ['source_seed_concierge'],
      confidenceScore: 79,
    },
    {
      eventId: createId('event', 'discovery'),
      caseId: 'case_raymond_teo_2026',
      timestampPrecision: 'exact',
      timestampStart: `${runtimeCase.victim.date}T04:22:00+08:00`,
      eventType: 'discovery',
      description: 'The housekeeper finds Raymond Teo unresponsive in the master bedroom.',
      peopleInvolved: ['person_raymond_teo'],
      locationLabel: runtimeCase.victim.location,
      sourceIds: ['source_seed_brief'],
      confidenceScore: 88,
    },
  ];
}

export function createSeedEvidence(runtimeCase: MysteryCase): EvidenceItem[] {
  return runtimeCase.clues.map<EvidenceItem>((clue, index) => ({
    evidenceId: createId('evidence', `${index}-${clue}`),
    caseId: 'case_raymond_teo_2026',
    label: `Evidence ${index + 1}`,
    evidenceType: index === 0 ? 'forensic' : index === 1 ? 'digital' : 'physical',
    description: clue,
    supports: index < 2 ? ['person_w_priya'] : [],
    contradicts: index === 2 ? ['person_w_priya'] : [],
    isPubliclyDocumented: true,
    gameplayValue: index === 2 ? 'red_herring' : 'core_clue',
    sourceIds: index === 0 ? ['source_seed_forensics'] : ['source_seed_access_log'],
    confidenceScore: index === 2 ? 51 : 86,
  }));
}

export function createSeedSources(runtimeCase: MysteryCase): SourceRecord[] {
  return [
    {
      sourceId: 'source_seed_brief',
      caseId: 'case_raymond_teo_2026',
      sourceType: 'news',
      publisher: 'Crime Scene Seed Data',
      title: runtimeCase.title,
      publicationDate: runtimeCase.victim.date,
      url: 'https://example.local/raymond-teo-case-brief',
      retrievedAt: seededAt,
      excerpt: runtimeCase.brief,
      credibilityTier: 'strong_secondary',
      dedupeHash: 'seed-brief',
      language: 'en',
    },
    {
      sourceId: 'source_seed_access_log',
      caseId: 'case_raymond_teo_2026',
      sourceType: 'court',
      title: 'Seed access log summary',
      url: 'https://example.local/raymond-teo-access-log',
      retrievedAt: seededAt,
      excerpt: runtimeCase.clues[1] ?? '',
      credibilityTier: 'primary',
      dedupeHash: 'seed-access-log',
      language: 'en',
    } as SourceRecord,
    {
      sourceId: 'source_seed_forensics',
      caseId: 'case_raymond_teo_2026',
      sourceType: 'police',
      title: 'Seed forensic note',
      url: 'https://example.local/raymond-teo-forensics',
      retrievedAt: seededAt,
      excerpt: runtimeCase.clues[0] ?? '',
      credibilityTier: 'primary',
      dedupeHash: 'seed-forensics',
      language: 'en',
    },
    {
      sourceId: 'source_seed_concierge',
      caseId: 'case_raymond_teo_2026',
      sourceType: 'interview',
      title: 'Marcus lobby statement',
      url: 'https://example.local/raymond-teo-concierge',
      retrievedAt: seededAt,
      excerpt: runtimeCase.witnesses[0]?.knows ?? '',
      credibilityTier: 'strong_secondary',
      dedupeHash: 'seed-concierge',
      language: 'en',
    },
  ];
}

export function createSeedMedia(): MediaCandidate[] {
  return [
    {
      mediaId: 'media_marcus_interview',
      caseId: 'case_raymond_teo_2026',
      personId: 'person_w_marcus',
      mediaKind: 'video',
      originType: 'interview',
      url: 'https://example.local/media/marcus-interview',
      transcriptAvailable: true,
      containsTargetPerson: true,
      faceVisibilityScore: 77,
      voiceIsolatedScore: 75,
      backgroundNoiseScore: 18,
      usableForCloneScore: 79,
      sourceIds: ['source_seed_concierge'],
      extractedAt: seededAt,
      durationSec: 134,
    },
    {
      mediaId: 'media_priya_photo',
      caseId: 'case_raymond_teo_2026',
      personId: 'person_w_priya',
      mediaKind: 'image',
      originType: 'archive_photo',
      url: 'https://example.local/media/priya-portrait',
      transcriptAvailable: false,
      containsTargetPerson: true,
      faceVisibilityScore: 88,
      voiceIsolatedScore: 0,
      backgroundNoiseScore: 0,
      usableForCloneScore: 74,
      sourceIds: ['source_seed_brief'],
      extractedAt: seededAt,
    },
  ];
}

export function createSeedReviews(): ReviewRecord[] {
  return [
    {
      reviewId: 'review_seed_case',
      caseId: 'case_raymond_teo_2026',
      reviewScope: 'case',
      reviewType: 'factual',
      status: 'approved',
      reviewer: 'seed-system',
      decisionReason: 'Seed demo case approved for pipeline validation.',
      decidedAt: seededAt,
    },
  ];
}

export function createSeedDerivedAssets(): DerivedAsset[] {
  return [
    {
      assetId: 'asset_seed_marcus_voice',
      caseId: 'case_raymond_teo_2026',
      personId: 'person_w_marcus',
      assetType: 'voice_line',
      toolProvider: 'manual',
      inputMediaIds: ['media_marcus_interview'],
      promptOrRecipe: 'Seeded asset from prototype witness voice.',
      modelName: 'seed-prototype',
      outputUri: '/assets/seed/marcus-intro.wav',
      generationDate: seededAt,
      qualityScore: 72,
      approvalStatus: 'approved',
    },
  ];
}

export function createSeedPackage(runtimeCase: MysteryCase): GameCasePackage {
  return {
    packageId: 'pkg_case_raymond_teo_2026_v1',
    caseId: 'case_raymond_teo_2026',
    title: runtimeCase.title,
    runtimeCase,
    witnessPromptPacks: runtimeCase.witnesses.map((witness) => ({
      witnessId: witness.id,
      systemPrompt: `You are ${witness.name}, the ${witness.role} in the ${runtimeCase.title} case. Stay in character, answer in 2-3 sentences, and never reveal the hidden truth directly.`,
      openingLine: `I'm ${witness.name}. Ask what you need to know.`,
      truthsTheyKnow: [witness.knows],
      secretsTheyHide: [witness.hiding],
      lieStrategy: witness.lies
        ? 'Deflect toward timing uncertainty and deny being present at the key moment.'
        : undefined,
    })),
    call911Script:
      'Operator, please send someone now. Mr. Teo is not moving and the bedroom looks wrong. I do not see blood, but something terrible has happened.',
    revealNarrationText: `The case turns on motive, access, and timing. ${runtimeCase.truth.motive} ${runtimeCase.truth.method}`,
    assetManifest: {
      sceneImageUri: '/assets/seed/raymond-scene.jpg',
      call911AudioUri: '/assets/seed/raymond-911.wav',
      revealNarrationAudioUri: '/assets/seed/raymond-reveal.wav',
      witnessPortraits: Object.fromEntries(
        runtimeCase.witnesses.map((witness) => [witness.id, `/assets/seed/${witness.id}.png`]),
      ),
      witnessVoiceSamples: Object.fromEntries(
        runtimeCase.witnesses.map((witness) => [witness.id, `/assets/seed/${witness.id}.wav`]),
      ),
    },
    packageVersion: '1.0.0',
    generatedAt: seededAt,
  };
}

export function createSeedBundle() {
  return {
    caseRecord: createSeedCaseRecord(raymondTeoCase),
    people: createSeedPeople(raymondTeoCase),
    timeline: createSeedTimeline(raymondTeoCase),
    evidence: createSeedEvidence(raymondTeoCase),
    sources: createSeedSources(raymondTeoCase),
    media: createSeedMedia(),
    reviews: createSeedReviews(),
    derivedAssets: createSeedDerivedAssets(),
    packageRecord: createSeedPackage(raymondTeoCase),
  };
}
