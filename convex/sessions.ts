import { internalMutation, mutation } from './_generated/server';
import { v } from 'convex/values';

export const QUESTIONS_PER_WITNESS_INTERRO = 3;
const MAX_DETECTIVE_QUESTION_LEN = 600;

/** Atomic cap + detective/witness transcript pair for AI interrogation (called from Convex action only). */
export const appendWitnessInterrogationExchange = internalMutation({
  args: {
    sessionId: v.id('sessions'),
    witnessId: v.string(),
    question: v.string(),
    witnessReply: v.string(),
    witnessReplyAudioUrl: v.optional(v.string()),
    detectiveTimestamp: v.number(),
    witnessTimestamp: v.number(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error('NO_SESSION');
    if (session.phase !== 'INTERROGATING') throw new Error('NOT_INTERVIEW');
    if (session.activeWitnessId !== args.witnessId) throw new Error('WRONG_WITNESS');

    const counts = session.witnessQuestionCounts ?? {};
    const prev = counts[args.witnessId] ?? 0;
    if (prev >= QUESTIONS_PER_WITNESS_INTERRO) throw new Error('QUESTION_LIMIT');

    await ctx.db.patch(args.sessionId, {
      witnessQuestionCounts: { ...counts, [args.witnessId]: prev + 1 },
      updatedAt: Date.now(),
    });

    const qText = args.question.trim().slice(0, MAX_DETECTIVE_QUESTION_LEN);
    const reply = args.witnessReply.trim().slice(0, 2000);

    await ctx.db.insert('transcripts', {
      sessionId: args.sessionId,
      witnessId: args.witnessId,
      speaker: 'detective',
      text: qText,
      timestamp: args.detectiveTimestamp,
    });
    await ctx.db.insert('transcripts', {
      sessionId: args.sessionId,
      witnessId: args.witnessId,
      speaker: 'witness',
      text: reply,
      timestamp: args.witnessTimestamp,
      audioUrl: args.witnessReplyAudioUrl,
    });

    return {
      remaining: QUESTIONS_PER_WITNESS_INTERRO - (prev + 1),
      usedAfter: prev + 1,
    };
  },
});

export const startInterview = mutation({
  args: { sessionId: v.id('sessions'), witnessId: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, {
      phase: 'INTERROGATING',
      activeWitnessId: args.witnessId,
      updatedAt: Date.now(),
    });
  },
});

export const endInterview = mutation({
  args: { sessionId: v.id('sessions') },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, {
      phase: 'CASE_BRIEF',
      activeWitnessId: undefined,
      updatedAt: Date.now(),
    });
  },
});

export const goToAccusation = mutation({
  args: { sessionId: v.id('sessions') },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, {
      phase: 'ACCUSING',
      updatedAt: Date.now(),
    });
  },
});

export const appendTranscriptLine = mutation({
  args: {
    sessionId: v.id('sessions'),
    witnessId: v.optional(v.string()),
    speaker: v.union(v.literal('witness'), v.literal('detective'), v.literal('system')),
    text: v.string(),
    timestamp: v.number(),
    audioUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('transcripts')
      .withIndex('by_session_timestamp', (q) =>
        q.eq('sessionId', args.sessionId).eq('timestamp', args.timestamp),
      )
      .collect();
    if (
      existing.some(
        (line) => line.speaker === args.speaker && line.text === args.text,
      )
    ) {
      return;
    }
    await ctx.db.insert('transcripts', args);
  },
});

export const resetSession = mutation({
  args: { sessionId: v.id('sessions') },
  handler: async (ctx, args) => {
    const lines = await ctx.db
      .query('transcripts')
      .withIndex('by_session_timestamp', (q) => q.eq('sessionId', args.sessionId))
      .collect();
    for (const line of lines) {
      await ctx.db.delete(line._id);
    }
    await ctx.db.patch(args.sessionId, {
      phase: 'CASE_BRIEF',
      activeWitnessId: undefined,
      accusation: undefined,
      isCorrect: undefined,
      revealNarration: undefined,
      witnessQuestionCounts: undefined,
      updatedAt: Date.now(),
    });
  },
});
