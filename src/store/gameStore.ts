import { create } from 'zustand';
import { gameBackend } from '@/backend/client';
import type { GameSnapshot } from '@/backend/contracts';
import { raymondTeoCase } from '@/data/raymondTeoCase';
import type { GamePhase, MysteryCase, TranscriptLine } from '@/types/case';

interface GameState {
  sessionId: string | null;
  phase: GamePhase;
  caseData: MysteryCase | null;
  sceneImageUrl: string | null;
  call911AudioUrl: string | null;
  activeWitnessId: string | null;
  accusation: string | null;
  isCorrect: boolean | null;
  revealNarration: string | null;
  transcript: TranscriptLine[];
  generationMs: number | null;

  loadStaticCase: () => Promise<void>;
  loadCase: (caseId: string) => Promise<void>;
  goToBrief: () => void;
  startInterrogation: (witnessId: string) => Promise<void>;
  endInterrogation: () => Promise<void>;
  goToAccusation: () => Promise<void>;
  submitAccusation: (text: string) => Promise<void>;
  resetCase: () => Promise<void>;
  appendTranscript: (line: TranscriptLine) => void;
}

function snapshotToState(snapshot: GameSnapshot) {
  return {
    sessionId: snapshot.session.id,
    phase: snapshot.session.phase,
    caseData: snapshot.caseData,
    sceneImageUrl: snapshot.media.sceneImageUrl,
    call911AudioUrl: snapshot.media.call911AudioUrl,
    generationMs: snapshot.generationMs,
    transcript: snapshot.transcript,
    activeWitnessId: snapshot.session.activeWitnessId,
    accusation: snapshot.session.accusation,
    isCorrect: snapshot.session.isCorrect,
    revealNarration: snapshot.session.revealNarration,
  };
}

export const useGameStore = create<GameState>((set, get) => ({
  sessionId: null,
  phase: 'LOADING',
  caseData: null,
  sceneImageUrl: null,
  call911AudioUrl: null,
  activeWitnessId: null,
  accusation: null,
  isCorrect: null,
  revealNarration: null,
  transcript: [],
  generationMs: null,

  loadStaticCase: async () => {
    await get().loadCase(raymondTeoCase.case_id);
  },

  loadCase: async (caseId) => {
    const snapshot = await gameBackend.loadCase(caseId);
    if (!snapshot) {
      set({
        phase: 'LOADING',
        sessionId: null,
        caseData: null,
        sceneImageUrl: null,
        call911AudioUrl: null,
        activeWitnessId: null,
        accusation: null,
        isCorrect: null,
        revealNarration: null,
        transcript: [],
        generationMs: null,
      });
      return;
    }
    set(snapshotToState(snapshot));
  },

  goToBrief: () => set({ phase: 'CASE_BRIEF', activeWitnessId: null }),

  startInterrogation: async (witnessId) => {
    const { sessionId } = get();
    if (!sessionId) return;
    const snapshot = await gameBackend.startInterview(sessionId, witnessId);
    set(snapshotToState(snapshot));
  },

  endInterrogation: async () => {
    const { sessionId } = get();
    if (!sessionId) {
      set({ phase: 'CASE_BRIEF', activeWitnessId: null });
      return;
    }
    const snapshot = await gameBackend.endInterview(sessionId);
    set(snapshotToState(snapshot));
  },

  goToAccusation: async () => {
    const { sessionId } = get();
    if (!sessionId) {
      set({ phase: 'ACCUSING' });
      return;
    }
    const snapshot = await gameBackend.goToAccusation(sessionId);
    set(snapshotToState(snapshot));
  },

  submitAccusation: async (text) => {
    const { sessionId } = get();
    if (!sessionId) return;
    const snapshot = await gameBackend.evaluateAccusation(sessionId, text);
    set(snapshotToState(snapshot));
  },

  resetCase: async () => {
    const { sessionId } = get();
    if (!sessionId) return;
    const snapshot = await gameBackend.resetSession(sessionId);
    set(snapshotToState(snapshot));
  },

  appendTranscript: (line) => {
    const { sessionId } = get();
    set((s) => {
      const key = `${line.speaker}:${line.timestamp}:${line.text}`;
      const exists = s.transcript.some(
        (item) => `${item.speaker}:${item.timestamp}:${item.text}` === key,
      );
      return exists ? s : { transcript: [...s.transcript, line] };
    });
    if (sessionId) {
      void gameBackend.appendTranscriptLine(sessionId, line);
    }
  },
}));
