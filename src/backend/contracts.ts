import type { GamePhase, MysteryCase, TranscriptLine } from '@/types/case';

export interface CaseMedia {
  sceneImageUrl: string | null;
  call911AudioUrl: string | null;
  revealNarrationAudioUrl: string | null;
  ambientAudioUrl: string | null;
}

export interface GameSession {
  id: string;
  caseId: string;
  phase: GamePhase;
  activeWitnessId: string | null;
  accusation: string | null;
  isCorrect: boolean | null;
  revealNarration: string | null;
  createdAt: number;
  updatedAt: number;
}

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
  resumeSession: (sessionId: string) => Promise<GameSnapshot | null>;
  startInterview: (sessionId: string, witnessId: string) => Promise<GameSnapshot>;
  endInterview: (sessionId: string) => Promise<GameSnapshot>;
  goToAccusation: (sessionId: string) => Promise<GameSnapshot>;
  appendTranscriptLine: (
    sessionId: string,
    line: TranscriptLine,
  ) => Promise<TranscriptLine[]>;
  evaluateAccusation: (
    sessionId: string,
    accusationText: string,
  ) => Promise<GameSnapshot & { result: AccusationResult }>;
  resetSession: (sessionId: string) => Promise<GameSnapshot>;
}
