import { getCurrentCasePackage } from '@/data/currentCasePackage';
import type { MysteryCase, TranscriptLine } from '@/types/case';
import type {
  AccusationResult,
  CaseMedia,
  GameBackend,
  GameSession,
  GameSnapshot,
} from './contracts';

const STORAGE_KEY = 'crime-scene.local-backend.v1';

interface LocalBackendState {
  session: GameSession;
  caseData: MysteryCase;
  media: CaseMedia;
  transcript: TranscriptLine[];
  generationMs: number | null;
}

const emptyMedia: CaseMedia = {
  sceneImageUrl: null,
  sceneModelUrl: null,
  call911AudioUrl: null,
  revealNarrationAudioUrl: null,
  ambientAudioUrl: null,
  witnessPortraitUrls: {},
  witnessVoiceSampleUrls: {},
  evidenceImageUrls: {},
  evidenceModelUrls: {},
  evidenceModelPreviewUrls: {},
};

function now() {
  return Date.now();
}

function makeId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Math.random().toString(36).slice(2)}_${now()}`;
}

function cloneCase(): MysteryCase {
  return structuredClone(getCurrentCasePackage().runtimeCase);
}

function buildMediaFromPackage(): CaseMedia {
  const manifest = getCurrentCasePackage().assetManifest;

  return {
    ...emptyMedia,
    sceneImageUrl: manifest.sceneImageUri ?? null,
    sceneModelUrl: manifest.sceneModelUri ?? null,
    call911AudioUrl: manifest.call911AudioUri ?? null,
    revealNarrationAudioUrl: manifest.revealNarrationAudioUri ?? null,
    witnessPortraitUrls: manifest.witnessPortraits ?? {},
    witnessVoiceSampleUrls: manifest.witnessVoiceSamples ?? {},
    evidenceImageUrls: manifest.evidenceRenders ?? {},
    evidenceModelUrls: manifest.evidenceModels ?? {},
    evidenceModelPreviewUrls: manifest.evidenceModelPreviews ?? {},
  };
}

function buildReveal(c: MysteryCase, correct: boolean): string {
  const killer = c.witnesses.find((w) => w.id === c.truth.killer);
  const killerName = killer?.name ?? 'Unknown';
  if (correct) {
    return `Case closed. ${killerName} killed ${c.victim.name}. ${c.truth.motive} ${c.truth.method} The hidden detail you may have missed: ${c.truth.hidden_clue}`;
  }
  return `Wrong call. The killer was ${killerName}. ${c.truth.motive} ${c.truth.method} What you missed: ${c.truth.hidden_clue}`;
}

function createState(): LocalBackendState {
  const caseData = cloneCase();
  const timestamp = now();
  return {
    session: {
      id: makeId('session'),
      caseId: caseData.case_id,
      phase: 'CASE_BRIEF',
      activeWitnessId: null,
      accusation: null,
      isCorrect: null,
      revealNarration: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    caseData,
    media: buildMediaFromPackage(),
    transcript: [],
    generationMs: 8300,
  };
}

function toSnapshot(state: LocalBackendState): GameSnapshot {
  return {
    session: { ...state.session },
    caseData: structuredClone(state.caseData),
    media: { ...state.media },
    transcript: [...state.transcript],
    generationMs: state.generationMs,
  };
}

function readState(): LocalBackendState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as LocalBackendState) : null;
  } catch {
    return null;
  }
}

function writeState(state: LocalBackendState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function updateState(edit: (state: LocalBackendState) => void): GameSnapshot {
  const state = readState() ?? createState();
  edit(state);
  state.session.updatedAt = now();
  writeState(state);
  return toSnapshot(state);
}

function transcriptKey(line: TranscriptLine) {
  return `${line.speaker}:${line.timestamp}:${line.text}`;
}

export const localBackend: GameBackend = {
  async startNewCase() {
    const state = createState();
    writeState(state);
    return toSnapshot(state);
  },

  async loadCase(caseId) {
    if (caseId !== raymondTeoCase.case_id) return null;
    const state = createState();
    writeState(state);
    return toSnapshot(state);
  },

  async resumeSession(sessionId) {
    const state = readState();
    if (!state || state.session.id !== sessionId) return null;
    return toSnapshot(state);
  },

  async startInterview(_sessionId, witnessId) {
    return updateState((state) => {
      state.session.phase = 'INTERROGATING';
      state.session.activeWitnessId = witnessId;
      state.transcript = [];
    });
  },

  async endInterview() {
    return updateState((state) => {
      state.session.phase = 'CASE_BRIEF';
      state.session.activeWitnessId = null;
    });
  },

  async goToAccusation() {
    return updateState((state) => {
      state.session.phase = 'ACCUSING';
    });
  },

  async appendTranscriptLine(_sessionId, line) {
    const snapshot = updateState((state) => {
      const seen = new Set(state.transcript.map(transcriptKey));
      if (!seen.has(transcriptKey(line))) {
        state.transcript.push(line);
      }
    });
    return snapshot.transcript;
  },

  async evaluateAccusation(_sessionId, accusationText) {
    const snapshot = updateState((state) => {
      const guess = accusationText.trim().toLowerCase();
      const killer = state.caseData.witnesses.find(
        (w) => w.id === state.caseData.truth.killer,
      );
      const firstName = killer?.name.toLowerCase().split(' ')[0] ?? '';
      const isCorrect = !!killer && guess.includes(firstName);
      state.session.phase = 'REVEAL';
      state.session.accusation = accusationText;
      state.session.isCorrect = isCorrect;
      state.session.revealNarration = buildReveal(state.caseData, isCorrect);
    });
    const result: AccusationResult = {
      accusation: snapshot.session.accusation ?? accusationText,
      isCorrect: !!snapshot.session.isCorrect,
      revealNarration: snapshot.session.revealNarration ?? '',
    };
    return { ...snapshot, result };
  },

  async resetSession() {
    return updateState((state) => {
      state.session.phase = 'CASE_BRIEF';
      state.session.activeWitnessId = null;
      state.session.accusation = null;
      state.session.isCorrect = null;
      state.session.revealNarration = null;
      state.transcript = [];
    });
  },
};
