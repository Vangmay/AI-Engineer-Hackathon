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
  WitnessQuestionResult,
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
  witnessModelUrls: {},
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
    witnessModelUrls: Object.fromEntries(
      Object.entries(m.witnessModels ?? {}).map(([id, uri]) => [
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

const MAX_WITNESS_QUESTION_LEN = 600;

function transcriptKey(line: TranscriptLine) {
  return `${line.speaker}:${line.timestamp}:${line.text}:${line.witnessId ?? ''}`;
}

function templateWitnessReply(witness: MysteryCase['witnesses'][number], question: string): string {
  const q = question.toLowerCase();
  if (/alibi|where were you|when did you|that night/i.test(q)) {
    return `You're asking the obvious timeline. ${witness.knows} I'll stick with that.`;
  }
  if (/motive|why would|why did/i.test(q)) {
    return `I didn't come here to spin motives—I laid out facts. ${witness.knows}`;
  }
  if (/see|saw|hear|notice|anything unusual/i.test(q)) {
    return `If it mattered, I already surfaced it plainly: ${witness.knows}`;
  }
  return `Fine. ${witness.knows} Anchor the minute and I'll walk you through it again—I work better under specifics.`;
}

export const localBackend: GameBackend = {
  async startNewCase() {
    const state = await createState();
    writeState(state);
    return toSnapshot(state);
  },

  async startRandomExistingCase() {
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
    });
  },

  async sendWitnessQuestion(sessionId, witnessId, question) {
    const trimmed = question.trim();
    if (!trimmed.length) return { ok: false as const, code: 'EMPTY_QUESTION' };
    if (trimmed.length > MAX_WITNESS_QUESTION_LEN)
      return { ok: false as const, code: 'QUESTION_TOO_LONG' };

    let state = readState();
    if (!state || state.session.id !== sessionId) {
      return { ok: false as const, code: 'NO_SESSION' };
    }
    if (state.session.phase !== 'INTERROGATING')
      return { ok: false as const, code: 'NOT_INTERVIEW' };
    if (state.session.activeWitnessId !== witnessId)
      return { ok: false as const, code: 'WRONG_WITNESS' };

    const counts = state.session.witnessQuestionCounts ?? {};
    const prev = counts[witnessId] ?? 0;
    if (prev >= 3) return { ok: false as const, code: 'LIMIT' };

    const witness = state.caseData.witnesses.find((w) => w.id === witnessId);
    if (!witness) return { ok: false as const, code: 'WITNESS_NOT_FOUND' };

    const reply = templateWitnessReply(witness, trimmed.slice(0, MAX_WITNESS_QUESTION_LEN));
    const baseTs = now();

    const snapshot = await updateState((s) => {
      s.session.witnessQuestionCounts = { ...(s.session.witnessQuestionCounts ?? {}), [witnessId]: prev + 1 };
      s.transcript.push({
        speaker: 'detective',
        text: trimmed.slice(0, MAX_WITNESS_QUESTION_LEN),
        timestamp: baseTs,
        witnessId,
      });
      s.transcript.push({
        speaker: 'witness',
        text: reply,
        timestamp: baseTs + 1,
        witnessId,
      });
    });

    const out: WitnessQuestionResult = {
      ok: true,
      snapshot,
      remainingQuestions: 3 - (prev + 1),
    };
    return out;
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

  async evaluateAccusation(_sessionId, suspectId) {
    const snapshot = await updateState((state) => {
      const selectedSuspect = state.caseData.witnesses.find((w) => w.id === suspectId);
      const isCorrect = suspectId === state.caseData.truth.killer;
      state.session.phase = 'REVEAL';
      state.session.accusation = selectedSuspect?.name ?? suspectId;
      state.session.isCorrect = isCorrect;
      state.session.revealNarration = buildReveal(state.caseData, isCorrect);
    });
    const result: AccusationResult = {
      accusation: snapshot.session.accusation ?? suspectId,
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
      state.session.witnessQuestionCounts = undefined;
      state.transcript = [];
    });
  },
};
