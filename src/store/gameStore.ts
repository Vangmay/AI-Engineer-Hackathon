import { create } from 'zustand';
import { gameBackend } from '@/backend/client';
import type { GameSnapshot } from '@/backend/contracts';
import type { GamePhase, MysteryCase, TranscriptLine } from '@/types/case';
import type { AssetManifest } from '@/types/gamePackage';

interface GameState {
  sessionId: string | null;
  phase: GamePhase;
  caseData: MysteryCase | null;
  sceneImageUrl: string | null;
  sceneModelUrl: string | null;
  call911AudioUrl: string | null;
  revealNarrationAudioUrl: string | null;
  witnessIntroAudioUrls: Record<string, string>;
  voiceModels: AssetManifest['voiceModels'];
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

  loadStaticCase: () => Promise<void>;
  loadCase: (caseId: string) => Promise<void>;
  setConvexMedia: (media: {
    sceneImageUrl: string | null;
    evidenceImageUrls: Record<string, string>;
    evidenceModelUrls: Record<string, string>;
    evidenceModelPreviewUrls: Record<string, string>;
    call911AudioUrl?: string | null;
    witnessIntroAudioUrls?: Record<string, string>;
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
    revealNarrationAudioUrl: snapshot.media.revealNarrationAudioUrl,
    witnessIntroAudioUrls: snapshot.media.witnessIntroAudioUrls,
    voiceModels: snapshot.media.voiceModels,
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
  revealNarrationAudioUrl: null,
  witnessIntroAudioUrls: {},
  voiceModels: {},
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

  /** Convex: new session for a random row in `cases` (no new case). Local: single bundled case. Empty DB: one `startNewCase` bootstrap. */
  loadStaticCase: async () => {
    const snapshot = await gameBackend.startRandomExistingCase();
    set(snapshotToState(snapshot));
  },

  loadCase: async (caseId) => {
    const snapshot = await gameBackend.loadCase(caseId);
    if (!snapshot) {
      set({
        phase: 'LOADING',
        sessionId: null,
        caseData: null,
        sceneImageUrl: null,
        sceneModelUrl: null,
        call911AudioUrl: null,
        revealNarrationAudioUrl: null,
        witnessIntroAudioUrls: {},
        voiceModels: {},
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
      });
      return;
    }
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
      call911AudioUrl:
        media.call911AudioUrl !== undefined && media.call911AudioUrl !== null
          ? media.call911AudioUrl
          : s.call911AudioUrl,
      witnessIntroAudioUrls:
        media.witnessIntroAudioUrls && Object.keys(media.witnessIntroAudioUrls).length > 0
          ? { ...s.witnessIntroAudioUrls, ...media.witnessIntroAudioUrls }
          : s.witnessIntroAudioUrls,
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
