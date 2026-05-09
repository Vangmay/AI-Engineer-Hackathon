export type CaseStatus =
  | 'unsolved'
  | 'solved'
  | 'disputed'
  | 'reopened'
  | 'cold_case';

export type GameAdaptationStatus =
  | 'not_started'
  | 'in_progress'
  | 'adapted'
  | 'blocked';

export type AssetGenerationStatus =
  | 'not_started'
  | 'queued'
  | 'generated'
  | 'reviewed'
  | 'rejected';

export type PersonRoleType =
  | 'suspect'
  | 'offender'
  | 'victim'
  | 'witness'
  | 'investigator'
  | 'journalist'
  | 'family'
  | 'other';

export type IdentityUseMode = 'real' | 'transformed' | 'exclude';
export type PreferredVoiceMode = 'real_clone' | 'profile_fallback' | 'undecided';

export type TimestampPrecision =
  | 'exact'
  | 'day'
  | 'month'
  | 'year'
  | 'unknown';

export type TimelineEventType =
  | 'crime'
  | 'discovery'
  | 'witness_statement'
  | 'police_action'
  | 'court_action'
  | 'media_report'
  | 'other';

export type EvidenceType =
  | 'physical'
  | 'forensic'
  | 'testimonial'
  | 'digital'
  | 'financial'
  | 'photographic'
  | 'audio'
  | 'document';

export type GameplayValue =
  | 'core_clue'
  | 'secondary_clue'
  | 'red_herring'
  | 'background_only';

export type SourceType =
  | 'news'
  | 'court'
  | 'police'
  | 'documentary'
  | 'interview'
  | 'podcast'
  | 'book'
  | 'archive'
  | 'wiki'
  | 'forum'
  | 'video';

export type CredibilityTier =
  | 'primary'
  | 'strong_secondary'
  | 'weak_secondary'
  | 'unverified';

export interface CaseRecord {
  caseId: string;
  canonicalTitle: string;
  aliases: string[];
  caseStatus: CaseStatus;
  jurisdictionCountry: string;
  jurisdictionRegion: string;
  primaryLanguage: string;
  incidentStartDate?: string;
  incidentEndDate?: string;
  summaryShort: string;
  summaryLong: string;
  mysteryFitScore: number;
  documentationScore: number;
  sourceCount: number;
  mediaRichnessScore: number;
  castClarityScore: number;
  priorityScore: number;
  gameAdaptationStatus: GameAdaptationStatus;
  assetGenerationStatus: AssetGenerationStatus;
  primaryLocationLabel?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PersonRecord {
  personId: string;
  caseId: string;
  fullName: string;
  aliases: string[];
  roleType: PersonRoleType;
  isPrimaryCharacter: boolean;
  isLiving: 'yes' | 'no' | 'unknown';
  birthYear?: number;
  deathYear?: number;
  nationality?: string;
  publicProfileLevel: 'low' | 'medium' | 'high';
  narrativeValueScore: number;
  suspicionScore: number;
  documentationScore: number;
  mediaRichnessScore: number;
  voiceCloneCandidate: boolean;
  faceCloneCandidate: boolean;
  identityUseMode: IdentityUseMode;
  preferredVoiceMode: PreferredVoiceMode;
  voiceProfile: {
    ageBand?: string;
    accentRegion?: string;
    speakingStyle?: string;
    genderPresentation?: string;
    demeanor?: string;
  };
  shortBio: string;
  notes?: string;
}

export interface TimelineEvent {
  eventId: string;
  caseId: string;
  timestampPrecision: TimestampPrecision;
  timestampStart?: string;
  timestampEnd?: string;
  eventType: TimelineEventType;
  description: string;
  peopleInvolved: string[];
  locationLabel?: string;
  sourceIds: string[];
  confidenceScore: number;
}

export interface EvidenceItem {
  evidenceId: string;
  caseId: string;
  label: string;
  evidenceType: EvidenceType;
  description: string;
  supports: string[];
  contradicts: string[];
  isPubliclyDocumented: boolean;
  gameplayValue: GameplayValue;
  sourceIds: string[];
  confidenceScore: number;
}

export interface SourceRecord {
  sourceId: string;
  caseId: string;
  sourceType: SourceType;
  publisher?: string;
  title: string;
  author?: string;
  publicationDate?: string;
  url: string;
  retrievedAt: string;
  excerpt: string;
  credibilityTier: CredibilityTier;
  licenseOrTermsNotes?: string;
  exaQueryId?: string;
  dedupeHash: string;
  language?: string;
  rawTextPath?: string;
}

export interface CandidateCaseRecord {
  caseId: string;
  canonicalTitle: string;
  summaryShort: string;
  querySet: string;
  query: string;
  priorityBucket: 'unsolved_documented' | 'solved_conflict' | 'general';
  inferredCaseStatus: CaseStatus | 'unknown';
  sourceUrl: string;
  sourceTitle: string;
  publishedDate?: string;
  exaQueryId?: string;
  mysteryFitScore: number;
  documentationScore: number;
  mediaRichnessScore: number;
  castClarityScore: number;
  priorityScore: number;
  createdAt: string;
  rawResult: Record<string, unknown>;
}
