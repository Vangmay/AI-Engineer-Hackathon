import type { ConvexReactClient } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import type {
  AccusationResult,
  CaseMedia,
  GameBackend,
  GameSession,
  GameSnapshot,
} from './contracts';
import type { MysteryCase, TranscriptLine } from '@/types/case';

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

function asSessionId(id: string): Id<'sessions'> {
  return id as Id<'sessions'>;
}

function mergeCaseDocToMystery(
  publicCase: MysteryCase | Record<string, unknown>,
  hiddenTruth: MysteryCase['truth'] | Record<string, unknown>,
): MysteryCase {
  const pc = publicCase as Omit<MysteryCase, 'truth'>;
  const truth = hiddenTruth as MysteryCase['truth'];
  return { ...pc, truth };
}

function mapTranscriptRows(
  rows: Array<{ speaker: TranscriptLine['speaker']; text: string; timestamp: number }>,
): TranscriptLine[] {
  return [...rows]
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((r) => ({ speaker: r.speaker, text: r.text, timestamp: r.timestamp }));
}

function snapshotFromConvexRow(row: {
  session: {
    _id: string;
    phase: GameSession['phase'];
    activeWitnessId?: string;
    accusation?: string;
    isCorrect?: boolean;
    revealNarration?: string;
    createdAt: number;
    updatedAt: number;
  };
  caseDoc: {
    caseId: string;
    publicCase: Record<string, unknown>;
    hiddenTruth: Record<string, unknown>;
    generation?: { generationMs?: number };
  };
  media: {
    sceneImageUrl?: string;
    sceneModelUrl?: string;
    call911AudioUrl?: string;
    revealNarrationAudioUrl?: string;
    ambientAudioUrl?: string;
    witnessIntroAudioUrls?: Record<string, string>;
    voiceModels?: CaseMedia['voiceModels'];
    witnessPortraitUrls?: Record<string, string>;
    witnessVoiceSampleUrls?: Record<string, string>;
    evidenceImageUrls?: Record<string, string>;
    evidenceModelUrls?: Record<string, string>;
    evidenceModelPreviewUrls?: Record<string, string>;
  } | null;
  transcript: Array<{
    speaker: TranscriptLine['speaker'];
    text: string;
    timestamp: number;
  }>;
}): GameSnapshot {
  const { session, caseDoc, media, transcript } = row;

  const caseData = mergeCaseDocToMystery(caseDoc.publicCase, caseDoc.hiddenTruth);

  const gameSession: GameSession = {
    id: session._id,
    caseId: caseDoc.caseId,
    phase: session.phase,
    activeWitnessId: session.activeWitnessId ?? null,
    accusation: session.accusation ?? null,
    isCorrect: session.isCorrect ?? null,
    revealNarration: session.revealNarration ?? null,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };

  const mediaOut: CaseMedia = {
    ...emptyMedia,
    ...(media
      ? {
          sceneImageUrl: media.sceneImageUrl ?? null,
          sceneModelUrl: media.sceneModelUrl ?? null,
          call911AudioUrl: media.call911AudioUrl ?? null,
          revealNarrationAudioUrl: media.revealNarrationAudioUrl ?? null,
          ambientAudioUrl: media.ambientAudioUrl ?? null,
          witnessIntroAudioUrls: media.witnessIntroAudioUrls ?? {},
          voiceModels: media.voiceModels ?? {},
          witnessPortraitUrls: media.witnessPortraitUrls ?? {},
          witnessModelUrls: {},
          witnessVoiceSampleUrls: media.witnessVoiceSampleUrls ?? {},
          evidenceImageUrls: media.evidenceImageUrls ?? {},
          evidenceModelUrls: media.evidenceModelUrls ?? {},
          evidenceModelPreviewUrls: media.evidenceModelPreviewUrls ?? {},
        }
      : {}),
  };

  return {
    session: gameSession,
    caseData,
    media: mediaOut,
    transcript: mapTranscriptRows(transcript),
    generationMs: caseDoc.generation?.generationMs ?? null,
  };
}

export function createConvexGameBackend(client: ConvexReactClient): GameBackend {
  async function fetchSnapshot(sessionId: string): Promise<GameSnapshot> {
    const row = await client.query(api.cases.getSessionSnapshot, {
      sessionId: asSessionId(sessionId),
    });
    if (!row) throw new Error('Session snapshot not found');
    return snapshotFromConvexRow(row);
  }

  return {
    async startNewCase() {
      const out = await client.action(api.cases.startNewCase, {});
      const sessionId = (out as { sessionId: string }).sessionId;
      return fetchSnapshot(sessionId);
    },

    async loadCase(caseIdSlug: string) {
      const caseRow = await client.query(api.cases.getCaseBySlug, { slug: caseIdSlug });
      if (!caseRow) return null;
      const sessionId = await client.mutation(api.cases.createSessionForCase, {
        caseConvexId: caseRow._id,
      });
      return fetchSnapshot(sessionId as unknown as string);
    },

    async resumeSession(sessionId) {
      const row = await client.query(api.cases.getSessionSnapshot, {
        sessionId: asSessionId(sessionId),
      });
      return row ? snapshotFromConvexRow(row) : null;
    },

    async startInterview(sessionId, witnessId) {
      await client.mutation(api.sessions.startInterview, {
        sessionId: asSessionId(sessionId),
        witnessId,
      });
      return fetchSnapshot(sessionId);
    },

    async endInterview(sessionId) {
      await client.mutation(api.sessions.endInterview, {
        sessionId: asSessionId(sessionId),
      });
      return fetchSnapshot(sessionId);
    },

    async goToAccusation(sessionId) {
      await client.mutation(api.sessions.goToAccusation, {
        sessionId: asSessionId(sessionId),
      });
      return fetchSnapshot(sessionId);
    },

    async appendTranscriptLine(sessionId, line) {
      await client.mutation(api.sessions.appendTranscriptLine, {
        sessionId: asSessionId(sessionId),
        speaker: line.speaker,
        text: line.text,
        timestamp: line.timestamp,
      });
      const snap = await fetchSnapshot(sessionId);
      return snap.transcript;
    },

    async evaluateAccusation(sessionId, accusationText) {
      const result = await client.mutation(api.accusations.evaluateAccusation, {
        sessionId: asSessionId(sessionId),
        accusationText,
      });
      const snap = await fetchSnapshot(sessionId);
      const typed = result as { isCorrect: boolean; revealNarration: string };
      const fullResult: AccusationResult = {
        accusation: accusationText,
        isCorrect: typed.isCorrect,
        revealNarration: typed.revealNarration,
      };
      return { ...snap, result: fullResult };
    },

    async resetSession(sessionId) {
      await client.mutation(api.sessions.resetSession, {
        sessionId: asSessionId(sessionId),
      });
      return fetchSnapshot(sessionId);
    },
  };
}
