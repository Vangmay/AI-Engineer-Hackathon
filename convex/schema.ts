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
    /** Questions already asked this session, keyed by dossier witness id (`witnesses.witnessId`). Max 3 per witness enforced in interrogation flow. */
    witnessQuestionCounts: v.optional(v.record(v.string(), v.number())),
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
    introAudioUrl: v.optional(v.string()),
    defaultAnswerAudioUrl: v.optional(v.string()),
    sampleAudioUrl: v.optional(v.string()),
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
    evidenceRenders: v.optional(v.any()),
    evidenceModels: v.optional(v.any()),
    evidenceModelPreviews: v.optional(v.any()),
    witnessPortraitUrls: v.optional(v.any()),
    updatedAt: v.number(),
  }).index('by_case', ['caseId']),

  audioAssets: defineTable({
    caseId: v.id('cases'),
    assetKey: v.string(),
    kind: v.union(
      v.literal('intro'),
      v.literal('default'),
      v.literal('sample'),
      v.literal('call911'),
      v.literal('reveal'),
      v.literal('ambient'),
      v.literal('other'),
    ),
    storageId: v.id('_storage'),
    url: v.string(),
    witnessId: v.optional(v.string()),
    characterRole: v.optional(v.string()),
    renderText: v.optional(v.string()),
    sourceAssetId: v.optional(v.string()),
    providerVoiceId: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index('by_case', ['caseId'])
    .index('by_case_asset_key', ['caseId', 'assetKey']),
});
