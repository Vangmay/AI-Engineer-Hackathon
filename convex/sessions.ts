import { mutation } from './_generated/server';
import { v } from 'convex/values';

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
      updatedAt: Date.now(),
    });
  },
});
