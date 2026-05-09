import { normalizeCaseAssetUrl } from '@/lib/caseAssetUrls';
import { getCurrentCasePackage } from '@/data/currentCasePackage';
import type { MysteryCase, TranscriptLine } from '@/types/case';
import type { GameCasePackage } from '@/types/gamePackage';
import type {
  AccusationResult,
  CaseMedia,
  GameBackend,
  GameSession,
  GameSnapshot,
} from './contracts';

const STORAGE_KEY = 'crime-scene.local-backend.v1';

const ACTIVE_CASE_ID =
  import.meta.env.VITE_ACTIVE_CASE_ID ?? 'case_colonel_russell_williams_2010';

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
  witnessIntroAudioUrls: {},
  voiceModels: {},
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

function mediaFromPackage(pkg: GameCasePackage): CaseMedia {
  const m = pkg.assetManifest;
  const renderedAudio = m.renderedAudio ?? { witnessIntroUris: {} };
  const intros = renderedAudio.witnessIntroUris ?? {};
  const voiceModels = m.voiceModels ?? {};
  const witnessVoiceSamples =
    Object.keys(m.witnessVoiceSamples ?? {}).length > 0
      ? (m.witnessVoiceSamples ?? {})
      : Object.fromEntries(
          Object.entries(voiceModels).map(([id, vm]) => [id, vm.sampleAssetUri ?? '']),
        );

  return {
    ...emptyMedia,
    sceneImageUrl: normalizeCaseAssetUrl(m.sceneImageUri) ?? null,
    sceneModelUrl: normalizeCaseAssetUrl(m.sceneModelUri) ?? null,
    call911AudioUrl:
      normalizeCaseAssetUrl(renderedAudio.call911AudioUri ?? m.call911AudioUri) ?? null,
    revealNarrationAudioUrl:
      normalizeCaseAssetUrl(renderedAudio.revealNarrationAudioUri ?? m.revealNarrationAudioUri) ??
      null,
    ambientAudioUrl: normalizeCaseAssetUrl(renderedAudio.ambientOrStingUris?.default) ?? null,
    witnessPortraitUrls: Object.fromEntries(
      Object.entries(m.witnessPortraits ?? {}).map(([id, uri]) => [
        id,
        normalizeCaseAssetUrl(uri) ?? '',
      ]),
    ),
    witnessVoiceSampleUrls: Object.fromEntries(
      Object.entries(witnessVoiceSamples).map(([id, uri]) => [id, normalizeCaseAssetUrl(uri) ?? '']),
    ),
    evidenceImageUrls: Object.fromEntries(
      Object.entries(m.evidenceRenders ?? {}).map(([id, uri]) => [id, normalizeCaseAssetUrl(uri) ?? '']),
    ),
    evidenceModelUrls: Object.fromEntries(
      Object.entries(m.evidenceModels ?? {}).map(([id, uri]) => [id, normalizeCaseAssetUrl(uri) ?? '']),
    ),
    evidenceModelPreviewUrls: Object.fromEntries(
      Object.entries(m.evidenceModelPreviews ?? {}).map(([id, uri]) => [
        id,
        normalizeCaseAssetUrl(uri) ?? '',
      ]),
    ),
    witnessIntroAudioUrls: Object.fromEntries(
      Object.entries(intros).map(([id, uri]) => [id, normalizeCaseAssetUrl(uri) ?? '']),
    ),
    voiceModels: Object.fromEntries(
      Object.entries(voiceModels).map(([id, vm]) => [
        id,
        {
          ...vm,
          sampleAssetUri: normalizeCaseAssetUrl(vm.sampleAssetUri),
        },
      ]),
    ),
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

async function loadCasePackage(): Promise<GameCasePackage> {
  try {
    const res = await fetch(`/case-assets/${ACTIVE_CASE_ID}/package.json`);
    if (res.ok) {
      return (await res.json()) as GameCasePackage;
    }
  } catch {
    /* use embedded fallback */
  }
  return getCurrentCasePackage();
}

async function createState(): Promise<LocalBackendState> {
  const casePackage = await loadCasePackage();
  const caseData = structuredClone(casePackage.runtimeCase);
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
    media: mediaFromPackage(casePackage),
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

async function updateState(edit: (state: LocalBackendState) => void): Promise<GameSnapshot> {
  let state = readState();
  if (!state) {
    state = await createState();
  }
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
    const state = await createState();
    writeState(state);
    return toSnapshot(state);
  },

  async loadCase(caseId) {
    const state = await createState();
    if (caseId !== state.caseData.case_id) return null;
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
    const snapshot = await updateState((state) => {
      const seen = new Set(state.transcript.map(transcriptKey));
      if (!seen.has(transcriptKey(line))) {
        state.transcript.push(line);
      }
    });
    return snapshot.transcript;
  },

  async evaluateAccusation(_sessionId, accusationText) {
    const snapshot = await updateState((state) => {
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
