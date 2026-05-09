import path from 'node:path';
import type { GameCasePackage } from '../../src/types/gamePackage.ts';
import type {
  ReviewRecord,
  MediaCandidate,
  DerivedAsset,
  VoiceRosterEntry,
} from '../../src/types/media.ts';
import type {
  CaseRecord,
  EvidenceItem,
  PersonRecord,
  SourceRecord,
  TimelineEvent,
} from '../../src/types/research.ts';
import { ensureDir, readJsonFile, writeJsonFile } from './fs.ts';
import { casesDir } from './paths.ts';

export interface CaseBundle {
  caseRecord: CaseRecord;
  people: PersonRecord[];
  timeline: TimelineEvent[];
  evidence: EvidenceItem[];
  sources: SourceRecord[];
  media: MediaCandidate[];
  reviews: ReviewRecord[];
  derivedAssets: DerivedAsset[];
  voiceRoster: VoiceRosterEntry[];
  packageRecord?: GameCasePackage;
}

export function getCaseDir(caseId: string): string {
  return path.join(casesDir, caseId);
}

export function ensureCaseDir(caseId: string): string {
  const dir = getCaseDir(caseId);
  ensureDir(path.join(dir, 'assets'));
  return dir;
}

export function loadCaseBundle(caseId: string): CaseBundle {
  const dir = getCaseDir(caseId);
  return {
    caseRecord: readJsonFile<CaseRecord>(path.join(dir, 'case.json'), {} as CaseRecord),
    people: readJsonFile<PersonRecord[]>(path.join(dir, 'people.json'), []),
    timeline: readJsonFile<TimelineEvent[]>(path.join(dir, 'timeline.json'), []),
    evidence: readJsonFile<EvidenceItem[]>(path.join(dir, 'evidence.json'), []),
    sources: readJsonFile<SourceRecord[]>(path.join(dir, 'sources.json'), []),
    media: readJsonFile<MediaCandidate[]>(path.join(dir, 'media.json'), []),
    reviews: readJsonFile<ReviewRecord[]>(path.join(dir, 'reviews.json'), []),
    derivedAssets: readJsonFile<DerivedAsset[]>(path.join(dir, 'derived-assets.json'), []),
    voiceRoster: readJsonFile<VoiceRosterEntry[]>(path.join(dir, 'voice-roster.json'), []),
    packageRecord: readJsonFile<GameCasePackage | undefined>(
      path.join(dir, 'package.json'),
      undefined,
    ),
  };
}

export function saveCaseBundle(caseId: string, bundle: Partial<CaseBundle>): void {
  const dir = ensureCaseDir(caseId);

  if (bundle.caseRecord) writeJsonFile(path.join(dir, 'case.json'), bundle.caseRecord);
  if (bundle.people) writeJsonFile(path.join(dir, 'people.json'), bundle.people);
  if (bundle.timeline) writeJsonFile(path.join(dir, 'timeline.json'), bundle.timeline);
  if (bundle.evidence) writeJsonFile(path.join(dir, 'evidence.json'), bundle.evidence);
  if (bundle.sources) writeJsonFile(path.join(dir, 'sources.json'), bundle.sources);
  if (bundle.media) writeJsonFile(path.join(dir, 'media.json'), bundle.media);
  if (bundle.reviews) writeJsonFile(path.join(dir, 'reviews.json'), bundle.reviews);
  if (bundle.derivedAssets) {
    writeJsonFile(path.join(dir, 'derived-assets.json'), bundle.derivedAssets);
  }
  if (bundle.voiceRoster) {
    writeJsonFile(path.join(dir, 'voice-roster.json'), bundle.voiceRoster);
  }
  if (bundle.packageRecord) writeJsonFile(path.join(dir, 'package.json'), bundle.packageRecord);
}
