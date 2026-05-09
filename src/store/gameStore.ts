import { create } from 'zustand';
import { gameBackend } from '@/backend/client';
import type { GameSnapshot } from '@/backend/contracts';
import type { GamePhase, MysteryCase, TranscriptLine } from '@/types/case';

interface GameState {
  sessionId: string | null;
  phase: GamePhase;
  caseData: MysteryCase | null;
  sceneImageUrl: string | null;
  sceneModelUrl: string | null;
  call911AudioUrl: string | null;
  witnessPortraitUrls: Record<string, string>;
  witnessVoiceSampleUrls: Record<string, string>;
  evidenceImageUrls: Record<string, string>;
  evidenceModelUrls: Record<string, string>;
  evidenceModelPreviewUrls: Record<string, string>;
  activeWitnessId: string | null;
  accusation: string | null;
  isCorrect: boolean | null;
  revealNarration: string | null;
  transcript: TranscriptLine[];
  generationMs: number | null;

  loadDataCase: () => Promise<void>;
  setConvexMedia: (media: {
    sceneImageUrl: string | null;
    evidenceImageUrls: Record<string, string>;
    evidenceModelUrls: Record<string, string>;
    evidenceModelPreviewUrls: Record<string, string>;
  }) => void;
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
    sceneModelUrl: snapshot.media.sceneModelUrl,
    call911AudioUrl: snapshot.media.call911AudioUrl,
    witnessPortraitUrls: snapshot.media.witnessPortraitUrls,
    witnessVoiceSampleUrls: snapshot.media.witnessVoiceSampleUrls,
    evidenceImageUrls: snapshot.media.evidenceImageUrls,
    evidenceModelUrls: snapshot.media.evidenceModelUrls,
    evidenceModelPreviewUrls: snapshot.media.evidenceModelPreviewUrls,
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
  sceneModelUrl: null,
  call911AudioUrl: null,
  witnessPortraitUrls: {},
  witnessVoiceSampleUrls: {},
  evidenceImageUrls: {},
  evidenceModelUrls: {},
  evidenceModelPreviewUrls: {},
  activeWitnessId: null,
  accusation: null,
  isCorrect: null,
  revealNarration: null,
  transcript: [],
  generationMs: null,

  loadDataCase: async () => {
    const snapshot = await gameBackend.startNewCase();
    set(snapshotToState(snapshot));
  },

  setConvexMedia: (media) => {
    set((s) => ({
      sceneImageUrl: media.sceneImageUrl ?? s.sceneImageUrl,
      evidenceImageUrls: Object.keys(media.evidenceImageUrls).length > 0
        ? media.evidenceImageUrls
        : s.evidenceImageUrls,
      evidenceModelUrls: Object.keys(media.evidenceModelUrls).length > 0
        ? media.evidenceModelUrls
        : s.evidenceModelUrls,
      evidenceModelPreviewUrls: Object.keys(media.evidenceModelPreviewUrls).length > 0
        ? media.evidenceModelPreviewUrls
        : s.evidenceModelPreviewUrls,
    }));
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
