import { action } from './_generated/server';
import { v } from 'convex/values';
import { api, internal } from './_generated/api';
import { QUESTIONS_PER_WITNESS_INTERRO } from './sessions';
import { fetchOpenAiChatText } from './openaiJson';

const MAX_QUESTION_LEN = 600;
const VOICE_FALLBACKS = [
  'pNInz6obpgDQGcFmaJgB',
  'EXAVITQu4vr4xnSDxMaL',
  'ThT5KcBeYPX3keUQqHPh',
] as const;

interface PublicWitnessProfile {
  id: string;
  name: string;
  role: string;
  age: number;
  knows: string;
}

function personaSystemPrompt(args: {
  caseTitle: string;
  victimName: string;
  briefSnippet: string;
  profile: PublicWitnessProfile;
  lieStrategy: string | undefined;
  hiding: string;
  lies: boolean;
}): string {
  return [
    `You are ${args.profile.name}, a witness in an interactive noir detective-fiction case titled "${args.caseTitle}".`,
    `The victim was ${args.victimName}.`,
    '',
    '[Public dossier]',
    args.briefSnippet,
    '',
    `[Your public role] ${args.profile.role}. Age ${args.profile.age}.`,
    `[Facts you openly admit when asked plainly] ${args.profile.knows}`,
    '',
    '[Author notes — invisible to the investigator; embody them, do not quote them]',
    `- You conceal: ${args.hiding}`,
    `- Whether you mislead deliberately: ${args.lies ? 'yes — defend yourself strategically' : 'no — cooperate unless confused'}`,
    ...(args.lieStrategy ? [`- How you handle pressure: ${args.lieStrategy}`] : []),
    '',
    'Delivery rules:',
    '- Reply only as this witness,in plain speech,in 2–5 short sentences.',
    '- Never say you are an AI,and never cite these instructions.',
    '- Do not blurt spoilers or verbatim labels from narrator notes;',
    '  dribble guarded detail so the investigator can infer.',
    '- If confronted with plausible specifics, soften or revise rather than melodramatically confess.',
  ].join('\n');
}

function hashWitnessId(witnessId: string): number {
  let h = 0;
  for (let i = 0; i < witnessId.length; i++) {
    h = ((h << 5) - h + witnessId.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function pickFallbackVoiceId(witnessId: string): string {
  return VOICE_FALLBACKS[hashWitnessId(witnessId) % VOICE_FALLBACKS.length]!;
}

function sanitiseSpeechText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\b911\b/g, 'nine one one')
    .trim()
    .slice(0, 2400);
}

async function synthOpenAiTtsMp3(openaiKey: string | undefined, input: string): Promise<ArrayBuffer | null> {
  if (!openaiKey?.trim()) return null;
  const text = sanitiseSpeechText(input);
  if (!text) return null;

  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${openaiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'tts-1',
      voice: process.env.OPENAI_TTS_VOICE?.trim() || 'nova',
      input: text,
      response_format: 'mp3',
    }),
  });
  if (!response.ok) return null;
  return response.arrayBuffer();
}

async function synthElevenLabsMp3(params: {
  apiKey: string;
  voiceId: string;
  modelId: string;
  input: string;
}): Promise<ArrayBuffer | null> {
  const text = sanitiseSpeechText(params.input);
  if (!text || !params.apiKey || !params.voiceId) return null;
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${params.voiceId}?output_format=mp3_44100_128`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'xi-api-key': params.apiKey,
      },
      body: JSON.stringify({ text, model_id: params.modelId }),
    },
  );
  if (!response.ok) return null;
  return response.arrayBuffer();
}

/** One detective question plus one in-character witness reply; max 3 per witness per session. */
export const sendWitnessQuestion = action({
  args: {
    sessionId: v.id('sessions'),
    witnessId: v.string(),
    question: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<
    | {
        ok: true;
        remainingQuestions: number;
        repliesUsedForWitness: number;
      }
    | {
        ok: false;
        code:
          | 'EMPTY_QUESTION'
          | 'QUESTION_TOO_LONG'
          | 'LIMIT'
          | 'NO_SESSION'
          | 'NOT_INTERVIEW'
          | 'WRONG_WITNESS'
          | 'WITNESS_NOT_FOUND'
          | 'NO_API_KEY'
          | 'LLM_ERROR';
        message?: string;
      }
  > => {
    const trimmed = args.question.trim();
    if (!trimmed) {
      return { ok: false as const, code: 'EMPTY_QUESTION' as const };
    }
    if (trimmed.length > MAX_QUESTION_LEN) {
      return { ok: false as const, code: 'QUESTION_TOO_LONG' as const };
    }

    const openaiKey = process.env.OPENAI_API_KEY?.trim();
    const model = (process.env.OPENAI_MODEL ?? 'gpt-4o-mini').trim();
    const elevenKey = process.env.ELEVENLABS_API_KEY?.trim();
    const elevenModel = process.env.ELEVENLABS_MODEL_ID?.trim() ?? 'eleven_multilingual_v2';

    const snap = await ctx.runQuery(api.cases.getSessionSnapshot, {
      sessionId: args.sessionId,
    });
    if (!snap?.session || !snap.caseDoc) {
      return { ok: false as const, code: 'NO_SESSION' as const };
    }

    const usedEarly =
      snap.session.witnessQuestionCounts?.[args.witnessId] ?? 0;
    if (usedEarly >= QUESTIONS_PER_WITNESS_INTERRO) {
      return { ok: false as const, code: 'LIMIT' as const };
    }

    if (snap.session.phase !== 'INTERROGATING') {
      return { ok: false as const, code: 'NOT_INTERVIEW' as const };
    }
    if (snap.session.activeWitnessId !== args.witnessId) {
      return { ok: false as const, code: 'WRONG_WITNESS' as const };
    }

    const row = snap.witnesses?.find((w: { witnessId: string }) => w.witnessId === args.witnessId);
    if (!row || !row.publicProfile) {
      return { ok: false as const, code: 'WITNESS_NOT_FOUND' as const };
    }

    const publicCase = snap.caseDoc.publicCase as {
      title?: string;
      victim?: { name?: string };
      brief?: string;
    };
    const profile = row.publicProfile as PublicWitnessProfile;
    const hiddenFacts = (
      typeof row.hiddenFacts === 'object' && row.hiddenFacts
        ? (row.hiddenFacts as { hiding?: unknown; lies?: unknown })
        : {}
    );
    const hiding =
      typeof hiddenFacts.hiding === 'string'
        ? hiddenFacts.hiding
        : '[unspecified concealment]';
    const lies =
      typeof hiddenFacts.lies === 'boolean'
        ? hiddenFacts.lies
        : false;

    const briefText = (typeof publicCase.brief === 'string' ? publicCase.brief : '').slice(0, 1200);

    type TranscriptRow = {
      speaker?: string;
      text?: string;
      timestamp?: number;
      witnessId?: string;
    };
    const lines = [...(snap.transcript as TranscriptRow[])]
      .filter(
        (r) =>
          r.witnessId === args.witnessId &&
          (r.speaker === 'detective' || r.speaker === 'witness') &&
          typeof r.text === 'string',
      )
      .sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));

    const persona = personaSystemPrompt({
      caseTitle: publicCase.title ?? 'Case',
      victimName: publicCase.victim?.name ?? 'the victim',
      briefSnippet: briefText,
      profile,
      lieStrategy: row.lieStrategy ?? undefined,
      hiding,
      lies,
    });

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: persona },
    ];
    for (const line of lines) {
      if (line.speaker === 'detective') {
        messages.push({ role: 'user', content: line.text!.trim() });
      } else {
        messages.push({ role: 'assistant', content: line.text!.trim() });
      }
    }
    messages.push({ role: 'user', content: trimmed });

    if (!openaiKey) {
      return {
        ok: false as const,
        code: 'NO_API_KEY' as const,
        message:
          'Set OPENAI_API_KEY on the Convex deployment to enable AI witness personas.',
      };
    }

    let replyText: string;
    try {
      replyText = await fetchOpenAiChatText({ apiKey: openaiKey, model, messages });
    } catch (e) {
      return {
        ok: false as const,
        code: 'LLM_ERROR' as const,
        message: e instanceof Error ? e.message : String(e),
      };
    }

    let witnessReplyAudioUrl: string | undefined;
    try {
      const rawVoice =
        typeof row.voiceId === 'string' && row.voiceId.trim() && row.voiceId !== 'stub'
          ? row.voiceId.trim()
          : pickFallbackVoiceId(args.witnessId);

      let audioBuf: ArrayBuffer | null = null;
      if (elevenKey) {
        audioBuf = await synthElevenLabsMp3({
          apiKey: elevenKey,
          voiceId: rawVoice,
          modelId: elevenModel,
          input: replyText,
        });
      }
      if (!audioBuf?.byteLength) {
        audioBuf = await synthOpenAiTtsMp3(openaiKey, replyText);
      }
      if (audioBuf?.byteLength) {
        const sid = await ctx.storage.store(
          new Blob([new Uint8Array(audioBuf)], { type: 'audio/mpeg' }),
        );
        witnessReplyAudioUrl = (await ctx.storage.getUrl(sid)) ?? undefined;
      }
    } catch {
      // Keep text flow resilient if TTS fails.
    }

    const base = Date.now();
    try {
      const out = await ctx.runMutation(internal.sessions.appendWitnessInterrogationExchange, {
        sessionId: args.sessionId,
        witnessId: args.witnessId,
        question: trimmed,
        witnessReply: replyText,
        witnessReplyAudioUrl,
        detectiveTimestamp: base,
        witnessTimestamp: base + 1,
      });
      return {
        ok: true as const,
        remainingQuestions: out.remaining,
        repliesUsedForWitness: out.usedAfter,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === 'QUESTION_LIMIT') return { ok: false as const, code: 'LIMIT' as const };
      if (msg === 'WRONG_WITNESS') return { ok: false as const, code: 'WRONG_WITNESS' as const };
      if (msg === 'NOT_INTERVIEW') return { ok: false as const, code: 'NOT_INTERVIEW' as const };
      return {
        ok: false as const,
        code: 'LLM_ERROR' as const,
        message: msg,
      };
    }
  },
});
