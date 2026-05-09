import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  sessions: defineTable({
    caseId: v.id('cases'),
    phase: v.union(
      v.literal('LOADING'),
      v.literal('CASE_BRIEF'),
      v.literal('INTERROGATING'),
      v.literal('ACCUSING'),
      v.literal('REVEAL'),
    ),
    activeWitnessId: v.optional(v.string()),
    accusation: v.optional(v.string()),
    isCorrect: v.optional(v.boolean()),
    revealNarration: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_updated_at', ['updatedAt']),

  cases: defineTable({
    caseId: v.string(),
    title: v.string(),
    publicCase: v.any(),
    hiddenTruth: v.any(),
    generation: v.object({
      model: v.string(),
      promptVersion: v.string(),
      generationMs: v.optional(v.number()),
      createdAt: v.number(),
      researchSourceUrls: v.optional(v.array(v.string())),
      researchSourceTitles: v.optional(v.array(v.string())),
      researchQuery: v.optional(v.string()),
    }),
  }).index('by_case_id', ['caseId']),

  witnesses: defineTable({
    caseId: v.id('cases'),
    witnessId: v.string(),
    publicProfile: v.any(),
    hiddenFacts: v.any(),
    voiceId: v.string(),
    lieStrategy: v.optional(v.string()),
  })
    .index('by_case', ['caseId'])
    .index('by_case_witness', ['caseId', 'witnessId']),

  transcripts: defineTable({
    sessionId: v.id('sessions'),
    witnessId: v.optional(v.string()),
    speaker: v.union(v.literal('witness'), v.literal('detective'), v.literal('system')),
    text: v.string(),
    timestamp: v.number(),
    audioUrl: v.optional(v.string()),
  }).index('by_session_timestamp', ['sessionId', 'timestamp']),

  media: defineTable({
    caseId: v.id('cases'),
    sceneImageUrl: v.optional(v.string()),
    call911AudioUrl: v.optional(v.string()),
    revealNarrationAudioUrl: v.optional(v.string()),
    ambientAudioUrl: v.optional(v.string()),
    updatedAt: v.number(),
  }).index('by_case', ['caseId']),
});
