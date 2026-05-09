import type { ConvexReactClient } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import type {
  AccusationResult,
  CaseMedia,
  GameBackend,
  GameSession,
  GameSnapshot,
  WitnessQuestionResult,
} from './contracts';
import type { Call911Line, MysteryCase, TranscriptLine } from '@/types/case';

function staleCase911Lines(caseData: MysteryCase): Call911Line[] {
  const victim = caseData.victim;
  const loc = victim.location.slice(0, 120);
  const firstWitness = caseData.witnesses[0];
  const firstClue = (caseData.clues[0] ?? '').slice(0, 110);
  const secondClue = (caseData.clues[1] ?? '').slice(0, 90);
  return [
    { who: 'DISP', text: "Nine-one-one, what's your emergency?" },
    {
      who: 'CALL',
      text: `I found ${victim.name} unresponsive at ${loc}. Send police and EMS now.`,
    },
    { who: 'DISP', text: 'Units are dispatching. What do you see and is anyone else still there?' },
    {
      who: 'CALL',
      text: `${firstWitness ? `${firstWitness.knows.slice(0, 80)}. ` : ''}${firstClue || 'No forced entry that I can see.'}`,
    },
    { who: 'DISP', text: 'Do not touch the room. Stay with me and report unusual details.' },
    { who: 'CALL', text: `${secondClue || 'There are signs someone moved around after the incident window.'} Please hurry.` },
  ];
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
  rows: Array<{
    speaker: TranscriptLine['speaker'];
    text: string;
    timestamp: number;
    witnessId?: string;
  }>,
): TranscriptLine[] {
  return [...rows]
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((r) => ({
      speaker: r.speaker,
      text: r.text,
      timestamp: r.timestamp,
      ...(r.witnessId ? { witnessId: r.witnessId } : {}),
    }));
}

function snapshotFromConvexRow(row: {
  witnesses?: Array<{ witnessId: string; introAudioUrl?: string }>;
  session: {
    _id: string;
    phase: GameSession['phase'];
    activeWitnessId?: string;
    accusation?: string;
    isCorrect?: boolean;
    revealNarration?: string;
    witnessQuestionCounts?: Record<string, number>;
    createdAt: number;
    updatedAt: number;
  };
  caseDoc: {
    caseId: string;
    publicCase: Record<string, unknown>;
    hiddenTruth: Record<string, unknown>;
    generation?: { generationMs?: number };
  };
  media: Record<string, unknown> | null;
  transcript: Array<{
    speaker: TranscriptLine['speaker'];
    text: string;
    timestamp: number;
    witnessId?: string;
  }>;
}): GameSnapshot {
  const { session, caseDoc, media, transcript, witnesses } = row;

  let caseData = mergeCaseDocToMystery(caseDoc.publicCase, caseDoc.hiddenTruth);

  const rawLines = (
    caseData as unknown as {
      call911_transcript?: Array<{ who: 'DISP' | 'CALL'; text: string }>;
    }
  ).call911_transcript;
  if ((!rawLines || rawLines.length < 6) && caseData.victim?.name && caseData.victim?.location) {
    caseData = {
      ...caseData,
      call911_transcript: staleCase911Lines(caseData),
    };
  }

  const gameSession: GameSession = {
    id: session._id,
    caseId: caseDoc.caseId,
    phase: session.phase,
    activeWitnessId: session.activeWitnessId ?? null,
    accusation: session.accusation ?? null,
    isCorrect: session.isCorrect ?? null,
    revealNarration: session.revealNarration ?? null,
    witnessQuestionCounts:
      session.witnessQuestionCounts && Object.keys(session.witnessQuestionCounts).length > 0
        ? { ...session.witnessQuestionCounts }
        : undefined,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };

  const mediaOut: CaseMedia = (() => {
    if (!media) return { ...emptyMedia };
    const m = media as Record<string, unknown>;
    const asRecord = (v: unknown): Record<string, string> =>
      v && typeof v === 'object' && !Array.isArray(v)
        ? (v as Record<string, string>)
        : {};
    return {
      ...emptyMedia,
      sceneImageUrl: (m.sceneImageUrl as string | undefined) ?? null,
      sceneModelUrl: (m.sceneModelUrl as string | undefined) ?? null,
      call911AudioUrl: (m.call911AudioUrl as string | undefined) ?? null,
      revealNarrationAudioUrl:
        (m.revealNarrationAudioUrl as string | undefined) ?? null,
      ambientAudioUrl: (m.ambientAudioUrl as string | undefined) ?? null,
      witnessIntroAudioUrls: {
        ...asRecord(m.witnessIntroAudioUrls),
        ...Object.fromEntries(
          (witnesses ?? [])
            .filter((w) => w.introAudioUrl)
            .map((w) => [w.witnessId, w.introAudioUrl!]),
        ),
      },
      voiceModels:
        (m.voiceModels as CaseMedia['voiceModels']) ?? ({} as CaseMedia['voiceModels']),
      witnessPortraitUrls: asRecord(m.witnessPortraitUrls),
      witnessVoiceSampleUrls: asRecord(m.witnessVoiceSampleUrls),
      evidenceImageUrls: asRecord(m.evidenceImageUrls ?? m.evidenceRenders),
      evidenceModelUrls: asRecord(m.evidenceModelUrls ?? m.evidenceModels),
      evidenceModelPreviewUrls: asRecord(
        m.evidenceModelPreviewUrls ?? m.evidenceModelPreviews,
      ),
    };
  })();

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

    async startRandomExistingCase() {
      const ids = await client.query(api.cases.listCaseConvexIds, {});
      if (ids.length === 0) {
        const out = await client.action(api.cases.startNewCase, {});
        return fetchSnapshot((out as { sessionId: string }).sessionId);
      }
      const pick = ids[Math.floor(Math.random() * ids.length)]!;
      const sessionId = await client.mutation(api.cases.createSessionForCase, {
        caseConvexId: pick,
      });
      return fetchSnapshot(sessionId as unknown as string);
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
        ...(line.witnessId ? { witnessId: line.witnessId } : {}),
      });
      const snap = await fetchSnapshot(sessionId);
      return snap.transcript;
    },

    async sendWitnessQuestion(sessionId, witnessId, question) {
      const result = await client.action(api.interrogation.sendWitnessQuestion, {
        sessionId: asSessionId(sessionId),
        witnessId,
        question,
      });
      if (!result.ok) {
        return result as WitnessQuestionResult;
      }
      const snap = await fetchSnapshot(sessionId);
      return {
        ok: true,
        snapshot: snap,
        remainingQuestions: result.remainingQuestions,
      };
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
