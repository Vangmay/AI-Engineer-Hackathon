import { action, internalMutation, mutation, query } from './_generated/server';
import type { MutationCtx } from './_generated/server';
import type { Id } from './_generated/dataModel';
import { internal } from './_generated/api';
import { v } from 'convex/values';
import {
  buildCorpusBackedUserPrompt,
  generateCaseBundle,
  LLM_CASE_SYSTEM,
  LLM_CASE_USER,
  LLM_CORPUS_SYSTEM_NOTE,
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
): Promise<{ sessionId: Id<'sessions'>; caseIdUsed: string }> {
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

  return { sessionId, caseIdUsed: generated.publicCase.case_id };
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
  handler: async (ctx, args) => {
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

const CORPUS_PROMPT_THRESHOLD = 220;

/** Primary entry: Exa retrieves real-case text (prefer Wikipedia via query hints) → LLM drafts fiction dossier → validate → persist. Falls back cleanly. */
export const startNewCase = action({
  args: {},
  handler: async (ctx) => {
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
    ) =>
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
          return await persistMutation(parsed, llmModel, promptVersion);
        }
      } catch {
        /* template fallback */
      }
    }

    const bundle = generateCaseBundle();
    const modelLabel = openaiKey ? 'template-fallback' : 'template-v1';
    const promptVersion = openaiKey ? 'template-fallback' : 'template-v1';
    return await persistMutation(bundle, modelLabel, promptVersion);
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

    return { session, caseDoc, media, transcript };
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
