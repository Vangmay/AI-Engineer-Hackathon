import { action, internalMutation, mutation, query } from './_generated/server';
import type { MutationCtx } from './_generated/server';
import type { Id } from './_generated/dataModel';
import { api, internal } from './_generated/api';
import { v } from 'convex/values';
import {
  buildCorpusBackedUserPrompt,
  generateCaseBundle,
  LLM_CASE_SYSTEM,
  LLM_CASE_USER,
  LLM_CORPUS_SYSTEM_NOTE,
  normalize911Transcript,
  tryParseLLMCaseBundle,
  type GeneratedCaseBundle,
} from './caseEngine';
import {
  buildResearchCorpus,
  pickQuery,
  rankResearchResults,
  searchExa,
} from './exaSearch';
import { fetchOpenAiJson } from './openaiJson';

type GenerationResearchMeta = {
  researchSourceUrls?: string[];
  researchSourceTitles?: string[];
  researchQuery?: string;
};

export type PersistCaseResult = {
  sessionId: Id<'sessions'>;
  caseIdUsed: string;
  caseConvexId: Id<'cases'>;
};

function researchArgsFromState(input: {
  sourceUrls: string[];
  sourceTitles: string[];
  researchQuery: string;
}): GenerationResearchMeta {
  const out: GenerationResearchMeta = {};
  if (input.sourceUrls.length > 0) out.researchSourceUrls = input.sourceUrls;
  if (input.sourceTitles.length > 0) out.researchSourceTitles = input.sourceTitles;
  if (input.researchQuery) out.researchQuery = input.researchQuery;
  return out;
}

async function persistCaseAndSession(
  ctx: MutationCtx,
  generated: GeneratedCaseBundle,
  timestamp: number,
  generationMeta: {
    model: string;
    promptVersion: string;
  } & GenerationResearchMeta,
): Promise<PersistCaseResult> {
  normalize911Transcript(generated.publicCase);

  const convexCaseRowId = await ctx.db.insert('cases', {
    caseId: generated.publicCase.case_id,
    title: generated.publicCase.title,
    publicCase: generated.publicCase,
    hiddenTruth: generated.hiddenTruth,
    generation: {
      model: generationMeta.model,
      promptVersion: generationMeta.promptVersion,
      generationMs: generated.generationMs,
      createdAt: timestamp,
      ...(generationMeta.researchSourceUrls?.length
        ? { researchSourceUrls: generationMeta.researchSourceUrls }
        : {}),
      ...(generationMeta.researchSourceTitles?.length
        ? { researchSourceTitles: generationMeta.researchSourceTitles }
        : {}),
      ...(generationMeta.researchQuery ? { researchQuery: generationMeta.researchQuery } : {}),
    },
  });
  await ctx.db.insert('media', { caseId: convexCaseRowId, updatedAt: timestamp });

  for (const witness of generated.publicCase.witnesses) {
    await ctx.db.insert('witnesses', {
      caseId: convexCaseRowId,
      witnessId: witness.id,
      publicProfile: witness,
      hiddenFacts: { hiding: witness.hiding, lies: witness.lies },
      voiceId: witness.voice_id,
      lieStrategy: witness.lies
        ? 'Deny being present during the exact murder window unless confronted with hard evidence.'
        : undefined,
    });
  }

  const sessionId = await ctx.db.insert('sessions', {
    caseId: convexCaseRowId,
    phase: 'CASE_BRIEF',
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  return { sessionId, caseIdUsed: generated.publicCase.case_id, caseConvexId: convexCaseRowId };
}

export const persistGeneratedCaseInternal = internalMutation({
  args: {
    publicCase: v.any(),
    hiddenTruth: v.any(),
    generationMs: v.number(),
    createdAt: v.number(),
    model: v.string(),
    promptVersion: v.string(),
    researchSourceUrls: v.optional(v.array(v.string())),
    researchSourceTitles: v.optional(v.array(v.string())),
    researchQuery: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<PersistCaseResult> => {
    const bundle: GeneratedCaseBundle = {
      publicCase: args.publicCase,
      hiddenTruth: args.hiddenTruth,
      generationMs: args.generationMs,
    };
    return await persistCaseAndSession(ctx, bundle, args.createdAt, {
      model: args.model,
      promptVersion: args.promptVersion,
      ...(args.researchSourceUrls?.length
        ? { researchSourceUrls: args.researchSourceUrls }
        : {}),
      ...(args.researchSourceTitles?.length
        ? { researchSourceTitles: args.researchSourceTitles }
        : {}),
      ...(args.researchQuery ? { researchQuery: args.researchQuery } : {}),
    });
  },
});

async function hydrateCaseMediaArtifacts(
  ctx: {
    runAction: (ref: typeof api.media.generateForCase, args: { caseId: Id<'cases'> }) => Promise<unknown>;
  },
  caseConvexId: Id<'cases'>,
): Promise<void> {
  try {
    await ctx.runAction(api.media.generateForCase, { caseId: caseConvexId });
  } catch (err) {
    console.error('[cases] generateForCase:', err);
  }
}

const CORPUS_PROMPT_THRESHOLD = 220;

/** Primary entry: Exa retrieves real-case text (prefer Wikipedia via query hints) → LLM drafts fiction dossier → validate → persist. Falls back cleanly. */
export const startNewCase = action({
  args: {},
  handler: async (ctx): Promise<PersistCaseResult> => {
    const timestamp = Date.now();
    const openaiKey = process.env.OPENAI_API_KEY;
    const llmModel = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
    const exaKey = process.env.EXA_API_KEY;

    let researchQuery = '';
    let corpusMarkdown = '';
    const sourceUrls: string[] = [];
    const sourceTitles: string[] = [];

    if (exaKey) {
      researchQuery = pickQuery();
      try {
        const exaResp = await searchExa({
          apiKey: exaKey,
          query: researchQuery,
          numResults: 8,
        });
        const ranked = rankResearchResults(exaResp.results);
        const built = buildResearchCorpus(ranked, { maxArticles: 4, maxTotalChars: 12000 });
        corpusMarkdown = built.corpus;
        sourceUrls.push(...built.sourceUrls);
        sourceTitles.push(...built.titles);
      } catch {
        /* continue without corpus */
      }
    }

    const researchPayload = researchArgsFromState({
      sourceUrls,
      sourceTitles,
      researchQuery,
    });

    const persistMutation = async (
      bundle: GeneratedCaseBundle,
      model: string,
      promptVersion: string,
    ): Promise<PersistCaseResult> =>
      ctx.runMutation(internal.cases.persistGeneratedCaseInternal, {
        publicCase: bundle.publicCase,
        hiddenTruth: bundle.hiddenTruth,
        generationMs: bundle.generationMs,
        createdAt: timestamp,
        model,
        promptVersion,
        ...researchPayload,
      });

    if (openaiKey) {
      const useCorpus = corpusMarkdown.length >= CORPUS_PROMPT_THRESHOLD;
      const userPrompt = useCorpus
        ? buildCorpusBackedUserPrompt(
            corpusMarkdown,
            sourceTitles.slice(0, 6).join(' | ').slice(0, 480),
          )
        : LLM_CASE_USER;
      const systemPrompt = useCorpus ? `${LLM_CASE_SYSTEM}${LLM_CORPUS_SYSTEM_NOTE}` : LLM_CASE_SYSTEM;

      const llmStarted = Date.now();
      try {
        const raw = await fetchOpenAiJson<Record<string, unknown>>({
          apiKey: openaiKey,
          model: llmModel,
          system: systemPrompt,
          user: userPrompt,
        });
        const parsed = tryParseLLMCaseBundle(raw, Date.now() - llmStarted);
        if (parsed) {
          const promptVersion = useCorpus ? 'llm-exa-corpora-v1' : 'llm-v1';
          const result = await persistMutation(parsed, llmModel, promptVersion);
          await hydrateCaseMediaArtifacts(ctx, result.caseConvexId);
          return result;
        }
      } catch {
        /* template fallback */
      }
    }

    const bundle = generateCaseBundle();
    const modelLabel = openaiKey ? 'template-fallback' : 'template-v1';
    const promptVersion = openaiKey ? 'template-fallback' : 'template-v1';
    const result = await persistMutation(bundle, modelLabel, promptVersion);
    await hydrateCaseMediaArtifacts(ctx, result.caseConvexId);
    return result;
  },
});

/** Same as legacy mutation: deterministic template/local generator (tests, pipelines without latency). */
export const startNewCaseFromTemplate = mutation({
  args: {},
  handler: async (ctx) => {
    const timestamp = Date.now();
    const generated = generateCaseBundle();
    return await persistCaseAndSession(ctx, generated, timestamp, {
      model: 'template-v1',
      promptVersion: 'template-v1',
    });
  },
});

/** All persisted case row ids (for lobby: pick one client-side without non-deterministic mutations). */
export const listCaseConvexIds = query({
  args: {},
  handler: async (ctx) => {
    const docs = await ctx.db.query('cases').collect();
    return docs.map((d) => d._id);
  },
});

export const getCaseByCaseId = query({
  args: { caseId: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query('cases')
      .withIndex('by_case_id', (q) => q.eq('caseId', args.caseId))
      .first();
  },
});

export const getSessionSnapshot = query({
  args: { sessionId: v.id('sessions') },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) return null;
    const caseDoc = await ctx.db.get(session.caseId);
    if (!caseDoc) return null;
    const media = await ctx.db
      .query('media')
      .withIndex('by_case', (q) => q.eq('caseId', session.caseId))
      .first();
    const transcript = await ctx.db
      .query('transcripts')
      .withIndex('by_session_timestamp', (q) => q.eq('sessionId', args.sessionId))
      .collect();
    const witnesses = await ctx.db
      .query('witnesses')
      .withIndex('by_case', (q) => q.eq('caseId', session.caseId))
      .collect();

    return { session, caseDoc, media, transcript, witnesses };
  },
});

/** Lookup Convex `cases` row by public dossier slug (`publicCase.case_id`). */
export const getCaseBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('cases')
      .withIndex('by_case_id', (q) => q.eq('caseId', args.slug))
      .first();
  },
});

/** New session for an existing case row (e.g. frontend `loadCase(slug)`). */
export const createSessionForCase = mutation({
  args: { caseConvexId: v.id('cases') },
  handler: async (ctx, args) => {
    const ts = Date.now();
    return await ctx.db.insert('sessions', {
      caseId: args.caseConvexId,
      phase: 'CASE_BRIEF',
      createdAt: ts,
      updatedAt: ts,
    });
  },
});

export const generateCase = mutation({
  args: {},
  handler: async (ctx) => {
    const timestamp = Date.now();
    const generated = generateCaseBundle();
    const { sessionId } = await persistCaseAndSession(ctx, generated, timestamp, {
      model: 'template-v1',
      promptVersion: 'generated-mutation-v1',
    });
    return {
      sessionId,
      caseId: generated.publicCase.case_id,
      generationMs: generated.generationMs,
    };
  },
});

/**
 * Admin cleanup: keep only fully rendered cases (target count), delete all other case trees.
 * A case is considered fully rendered when it has scene + 911 + full witness intros + portraits + clue renders.
 */
export const pruneCasesKeepingRendered = mutation({
  args: {
    targetCount: v.optional(v.number()),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const targetCount = Math.max(1, Math.floor(args.targetCount ?? 5));
    const dryRun = Boolean(args.dryRun);

    const allCases = await ctx.db.query('cases').collect();
    const evaluated: Array<{
      caseRowId: Id<'cases'>;
      caseId: string;
      complete: boolean;
      score: number;
      createdAt: number;
      witnessCount: number;
      clueCount: number;
      notes: string[];
    }> = [];

    for (const row of allCases) {
      const [mediaDoc, witnessRows] = await Promise.all([
        ctx.db
          .query('media')
          .withIndex('by_case', (q) => q.eq('caseId', row._id))
          .first(),
        ctx.db
          .query('witnesses')
          .withIndex('by_case', (q) => q.eq('caseId', row._id))
          .collect(),
      ]);

      const publicCase = (row.publicCase ?? {}) as {
        clues?: unknown[];
      };
      const clues = Array.isArray(publicCase.clues) ? publicCase.clues : [];

      const portraits =
        (mediaDoc?.witnessPortraitUrls as Record<string, string> | undefined) ?? {};
      const renders =
        (mediaDoc?.evidenceRenders as Record<string, string> | undefined) ?? {};

      const sceneReady = Boolean(mediaDoc?.sceneImageUrl?.trim());
      const callReady = Boolean(mediaDoc?.call911AudioUrl?.trim());
      const introsReady = witnessRows.every((w) => Boolean(w.introAudioUrl?.trim()));
      const portraitsReady = witnessRows.every((w) => Boolean(portraits[w.witnessId]?.trim()));
      const evidenceReady =
        clues.length > 0
          ? clues.every((_, idx) => Boolean(renders[String(idx)]?.trim()))
          : true;

      const score =
        (sceneReady ? 1 : 0) +
        (callReady ? 1 : 0) +
        (introsReady ? 1 : 0) +
        (portraitsReady ? 1 : 0) +
        (evidenceReady ? 1 : 0);

      const notes: string[] = [];
      if (!sceneReady) notes.push('missing_scene');
      if (!callReady) notes.push('missing_911');
      if (!introsReady) notes.push('missing_intro_audio');
      if (!portraitsReady) notes.push('missing_witness_portraits');
      if (!evidenceReady) notes.push('missing_evidence_renders');

      evaluated.push({
        caseRowId: row._id,
        caseId: row.caseId,
        complete: score === 5,
        score,
        createdAt: row.generation?.createdAt ?? 0,
        witnessCount: witnessRows.length,
        clueCount: clues.length,
        notes,
      });
    }

    const completeRows = evaluated
      .filter((e) => e.complete)
      .sort((a, b) => b.createdAt - a.createdAt);

    if (completeRows.length < targetCount) {
      return {
        ok: false as const,
        reason: 'not_enough_complete_cases',
        totalCases: allCases.length,
        completeCases: completeRows.length,
        requested: targetCount,
        examples: completeRows.slice(0, 10).map((e) => e.caseId),
      };
    }

    const keepSet = new Set(completeRows.slice(0, targetCount).map((e) => e.caseRowId));
    const deleteRows = evaluated.filter((e) => !keepSet.has(e.caseRowId));

    if (dryRun) {
      return {
        ok: true as const,
        dryRun: true as const,
        targetCount,
        keep: evaluated
          .filter((e) => keepSet.has(e.caseRowId))
          .map((e) => ({ caseId: e.caseId, score: e.score })),
        deleteCount: deleteRows.length,
      };
    }

    for (const row of deleteRows) {
      const [mediaRows, witnessRows, audioRows, sessionRows] = await Promise.all([
        ctx.db
          .query('media')
          .withIndex('by_case', (q) => q.eq('caseId', row.caseRowId))
          .collect(),
        ctx.db
          .query('witnesses')
          .withIndex('by_case', (q) => q.eq('caseId', row.caseRowId))
          .collect(),
        ctx.db
          .query('audioAssets')
          .withIndex('by_case', (q) => q.eq('caseId', row.caseRowId))
          .collect(),
        ctx.db.query('sessions').collect(),
      ]);

      const caseSessions = sessionRows.filter((s) => s.caseId === row.caseRowId);
      for (const s of caseSessions) {
        const lines = await ctx.db
          .query('transcripts')
          .withIndex('by_session_timestamp', (q) => q.eq('sessionId', s._id))
          .collect();
        for (const line of lines) await ctx.db.delete(line._id);
        await ctx.db.delete(s._id);
      }

      for (const m of mediaRows) await ctx.db.delete(m._id);
      for (const w of witnessRows) await ctx.db.delete(w._id);
      for (const a of audioRows) await ctx.db.delete(a._id);
      await ctx.db.delete(row.caseRowId);
    }

    return {
      ok: true as const,
      dryRun: false as const,
      targetCount,
      keptCaseIds: evaluated
        .filter((e) => keepSet.has(e.caseRowId))
        .map((e) => e.caseId),
      deletedCaseIds: deleteRows.map((e) => e.caseId),
    };
  },
});
