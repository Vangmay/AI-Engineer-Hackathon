import type { GamePhase, MysteryCase, TranscriptLine } from '@/types/case';
import type { AssetManifest } from '@/types/gamePackage';

export interface CaseMedia {
  sceneImageUrl: string | null;
  sceneModelUrl: string | null;
  call911AudioUrl: string | null;
  revealNarrationAudioUrl: string | null;
  ambientAudioUrl: string | null;
  witnessIntroAudioUrls: Record<string, string>;
  voiceModels: AssetManifest['voiceModels'];
  witnessPortraitUrls: Record<string, string>;
  witnessModelUrls: Record<string, string>;
  witnessVoiceSampleUrls: Record<string, string>;
  evidenceImageUrls: Record<string, string>;
  evidenceModelUrls: Record<string, string>;
  evidenceModelPreviewUrls: Record<string, string>;
}

export interface GameSession {
  id: string;
  caseId: string;
  phase: GamePhase;
  activeWitnessId: string | null;
  accusation: string | null;
  isCorrect: boolean | null;
  revealNarration: string | null;
  /** Questions consumed this session keyed by dossier witness id (max 3 per witness enforced in interrogation). */
  witnessQuestionCounts?: Record<string, number>;
  createdAt: number;
  updatedAt: number;
}

export type WitnessQuestionErrorCode =
  | 'EMPTY_QUESTION'
  | 'QUESTION_TOO_LONG'
  | 'LIMIT'
  | 'NO_SESSION'
  | 'NOT_INTERVIEW'
  | 'WRONG_WITNESS'
  | 'WITNESS_NOT_FOUND'
  | 'NO_API_KEY'
  | 'LLM_ERROR';

export type WitnessQuestionResult =
  | { ok: true; snapshot: GameSnapshot; remainingQuestions: number }
  | { ok: false; code: WitnessQuestionErrorCode; message?: string };

export interface GameSnapshot {
  session: GameSession;
  caseData: MysteryCase;
  media: CaseMedia;
  transcript: TranscriptLine[];
  generationMs: number | null;
}

export interface AccusationResult {
  accusation: string;
  isCorrect: boolean;
  revealNarration: string;
}

export interface GameBackend {
  startNewCase: () => Promise<GameSnapshot>;
  /** Picks an existing persisted case (Convex) or bundled case (local). No LLM/extra row unless Convex has zero cases yet. */
  startRandomExistingCase: () => Promise<GameSnapshot>;
  loadCase: (caseId: string) => Promise<GameSnapshot | null>;
  resumeSession: (sessionId: string) => Promise<GameSnapshot | null>;
  startInterview: (sessionId: string, witnessId: string) => Promise<GameSnapshot>;
  endInterview: (sessionId: string) => Promise<GameSnapshot>;
  goToAccusation: (sessionId: string) => Promise<GameSnapshot>;
  appendTranscriptLine: (
    sessionId: string,
    line: TranscriptLine,
  ) => Promise<TranscriptLine[]>;
  sendWitnessQuestion: (
    sessionId: string,
    witnessId: string,
    question: string,
  ) => Promise<WitnessQuestionResult>;
  evaluateAccusation: (
    sessionId: string,
    accusationText: string,
  ) => Promise<GameSnapshot & { result: AccusationResult }>;
  resetSession: (sessionId: string) => Promise<GameSnapshot>;
}
