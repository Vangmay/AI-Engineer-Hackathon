import { create } from 'zustand';
import type { GamePhase, MysteryCase, TranscriptLine } from '@/types/case';
import { raymondTeoCase } from '@/data/raymondTeoCase';

interface GameState {
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

  loadStaticCase: () => void;
  goToBrief: () => void;
  startInterrogation: (witnessId: string) => void;
  endInterrogation: () => void;
  goToAccusation: () => void;
  submitAccusation: (text: string) => void;
  resetCase: () => void;
  appendTranscript: (line: TranscriptLine) => void;
}

export const useGameStore = create<GameState>((set, get) => ({
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

  loadStaticCase: () => {
    set({
      phase: 'CASE_BRIEF',
      caseData: raymondTeoCase,
      sceneImageUrl: null,
      call911AudioUrl: null,
      generationMs: 8300,
      transcript: [],
      activeWitnessId: null,
      accusation: null,
      isCorrect: null,
      revealNarration: null,
    });
  },

  goToBrief: () => set({ phase: 'CASE_BRIEF', activeWitnessId: null }),

  startInterrogation: (witnessId) =>
    set({ phase: 'INTERROGATING', activeWitnessId: witnessId, transcript: [] }),

  endInterrogation: () => set({ phase: 'CASE_BRIEF', activeWitnessId: null }),

  goToAccusation: () => set({ phase: 'ACCUSING' }),

  submitAccusation: (text) => {
    const { caseData } = get();
    if (!caseData) return;
    const guess = text.trim().toLowerCase();
    const killer = caseData.witnesses.find(
      (w) => w.id === caseData.truth.killer,
    );
    const correct = !!killer && guess.includes(killer.name.toLowerCase().split(' ')[0]);
    set({
      phase: 'REVEAL',
      accusation: text,
      isCorrect: correct,
      revealNarration: buildReveal(caseData, correct),
    });
  },

  resetCase: () => {
    set({
      phase: 'CASE_BRIEF',
      activeWitnessId: null,
      accusation: null,
      isCorrect: null,
      revealNarration: null,
      transcript: [],
    });
  },

  appendTranscript: (line) =>
    set((s) => ({ transcript: [...s.transcript, line] })),
}));

function buildReveal(c: MysteryCase, correct: boolean): string {
  const killer = c.witnesses.find((w) => w.id === c.truth.killer);
  const killerName = killer?.name ?? 'Unknown';
  if (correct) {
    return `Case closed. ${killerName} killed ${c.victim.name}. ${c.truth.motive} ${c.truth.method} The hidden detail you may have missed: ${c.truth.hidden_clue}`;
  }
  return `Wrong call. The killer was ${killerName}. ${c.truth.motive} ${c.truth.method} What you missed: ${c.truth.hidden_clue}`;
}
