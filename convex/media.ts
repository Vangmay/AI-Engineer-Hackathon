import { action, internalMutation, internalQuery, query } from './_generated/server';
import { v } from 'convex/values';
import { internal } from './_generated/api';

// ── Prompt sanitisation ──────────────────────────────────────────────────────
// fal.ai safety filters silently return blank images for crime/drug keywords.
// Replace them before sending to any image generation API.

const SANITISE_RULES: Array<[RegExp, string]> = [
  [/\bvictim\b/gi, 'subject'],
  [/\bbenzodiazepine\w*\b/gi, 'white crystalline residue'],
  [/\bfentanyl\b/gi, 'white powder'],
  [/\bcocaine\b/gi, 'white powder'],
  [/\bheroin\b/gi, 'brown substance'],
  [/\bamphetamine\w*\b/gi, 'powder substance'],
  [/\bnarcotic\w*\b/gi, 'substance'],
  [/\bnot prescribed\b/gi, 'unidentified'],
  [/\bprescribed to the\b/gi, 'logged for the'],
  [/\bkilled?\b/gi, 'found'],
  [/\bmurdered?\b/gi, 'found'],
  [/\bblood\b/gi, 'dark fluid'],
  [/\bstrangulat\w*\b/gi, 'trauma'],
  [/\bstabbed?\b/gi, 'marked'],
  [/\btime of death\b/gi, 'logged timestamp'],
  [/\bTOD\b/g, 'logged timestamp'],
  [/\bdeceased\b/gi, 'subject'],
  [/\bmurder\w*\b/gi, 'incident'],
  [/\bhomicide\b/gi, 'incident'],
  [/\bmatches no one\b/gi, 'unidentified'],
];

function sanitisePrompt(text: string): string {
  let out = text;
  for (const [pattern, replacement] of SANITISE_RULES) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

function buildSceneImagePrompt(scenePrompt: string): string {
  const safe = sanitisePrompt(scenePrompt);
  return [
    'Luxury Singapore high-rise penthouse apartment interior, stylish modern decor, subdued evening lighting.',
    safe,
    'Singapore Police Force CID forensic documentation photograph, evidence markers visible, cinematic composition, no gore, no readable text.',
  ].join(' ');
}

// ── fal.ai image generation ──────────────────────────────────────────────────

interface FalImageResponse {
  images?: Array<{ url?: string }>;
}

async function falGenerateImage(prompt: string, apiKey: string): Promise<string> {
  const res = await fetch('https://fal.run/fal-ai/flux-pro', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Key ${apiKey}`,
    },
    body: JSON.stringify({
      prompt,
      aspect_ratio: '4:3',
      num_images: 1,
      output_format: 'jpeg',
      safety_tolerance: 6,
      enhance_prompt: false,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`fal image generation failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as FalImageResponse;
  const url = data.images?.[0]?.url;
  if (!url) throw new Error('fal returned no image URL');
  return url;
}

// ── Internal helpers ─────────────────────────────────────────────────────────

export const getCaseDoc = internalQuery({
  args: { caseId: v.id('cases') },
  handler: async (ctx, args) => {
    return ctx.db.get(args.caseId);
  },
});

export const getMediaDoc = internalQuery({
  args: { caseId: v.id('cases') },
  handler: async (ctx, args) => {
    return ctx.db
      .query('media')
      .withIndex('by_case', (q) => q.eq('caseId', args.caseId))
      .first();
  },
});

// ── Internal mutation: write URLs to DB ──────────────────────────────────────

export const patchMedia = internalMutation({
  args: {
    caseId: v.id('cases'),
    sceneImageUrl: v.optional(v.string()),
    call911AudioUrl: v.optional(v.string()),
    revealNarrationAudioUrl: v.optional(v.string()),
    ambientAudioUrl: v.optional(v.string()),
    evidenceRenders: v.optional(v.any()),
    evidenceModels: v.optional(v.any()),
    evidenceModelPreviews: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const { caseId, ...fields } = args;
    const patch = Object.fromEntries(
      Object.entries(fields).filter(([, val]) => val !== undefined),
    ) as Record<string, unknown>;

    const existing = await ctx.db
      .query('media')
      .withIndex('by_case', (q) => q.eq('caseId', caseId))
      .first();

    if (!existing) {
      await ctx.db.insert('media', { caseId, ...patch, updatedAt: Date.now() });
    } else {
      await ctx.db.patch(existing._id, { ...patch, updatedAt: Date.now() });
    }
  },
});

// ── Public query: media for a case ───────────────────────────────────────────

export const getMediaForCase = query({
  args: { caseId: v.id('cases') },
  handler: async (ctx, args) => {
    return ctx.db
      .query('media')
      .withIndex('by_case', (q) => q.eq('caseId', args.caseId))
      .first();
  },
});

export const getMediaByCaseStringId = query({
  args: { caseId: v.string() },
  handler: async (ctx, args) => {
    const caseDoc = await ctx.db
      .query('cases')
      .withIndex('by_case_id', (q) => q.eq('caseId', args.caseId))
      .first();
    if (!caseDoc) return null;
    return ctx.db
      .query('media')
      .withIndex('by_case', (q) => q.eq('caseId', caseDoc._id))
      .first();
  },
});

// ── Public action: generate and cache media for a case ───────────────────────
// Pattern A: client calls startNewCase, then immediately calls this action.
// Idempotent: skips any field already set unless force=true.

export const generateForCase = action({
  args: {
    caseId: v.id('cases'),
    force: v.optional(v.boolean()),
    // Pre-generated asset maps from the build pipeline (optional).
    // Pass these to skip re-generating and just cache in Convex.
    sceneImageUrl: v.optional(v.string()),
    evidenceRenders: v.optional(v.any()),
    evidenceModels: v.optional(v.any()),
    evidenceModelPreviews: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const [media, caseDoc] = await Promise.all([
      ctx.runQuery(internal.media.getMediaDoc, { caseId: args.caseId }),
      ctx.runQuery(internal.media.getCaseDoc, { caseId: args.caseId }),
    ]);

    if (!caseDoc) throw new Error(`Case ${args.caseId} not found`);

    const patch: Record<string, unknown> = {};

    // Scene image — use pre-generated if provided, otherwise generate via fal.ai
    if (!media?.sceneImageUrl || args.force) {
      if (args.sceneImageUrl) {
        patch.sceneImageUrl = args.sceneImageUrl;
      } else {
        const apiKey = process.env.FAL_API_KEY;
        if (apiKey) {
          const scenePrompt = buildSceneImagePrompt(
            (caseDoc.publicCase as { scene_prompt?: string }).scene_prompt ?? caseDoc.title,
          );
          try {
            patch.sceneImageUrl = await falGenerateImage(scenePrompt, apiKey);
          } catch (err) {
            console.error('[media] scene image generation failed:', err);
          }
        }
      }
    }

    // Evidence assets — store pre-generated URLs if provided
    if (args.evidenceRenders && (!media?.evidenceRenders || args.force)) {
      patch.evidenceRenders = args.evidenceRenders;
    }
    if (args.evidenceModels && (!media?.evidenceModels || args.force)) {
      patch.evidenceModels = args.evidenceModels;
    }
    if (args.evidenceModelPreviews && (!media?.evidenceModelPreviews || args.force)) {
      patch.evidenceModelPreviews = args.evidenceModelPreviews;
    }

    if (Object.keys(patch).length > 0) {
      await ctx.runMutation(internal.media.patchMedia, {
        caseId: args.caseId,
        ...patch,
      } as Parameters<typeof ctx.runMutation>[1]);
    }

    return {
      sceneImageUrl: (patch.sceneImageUrl as string | undefined) ?? media?.sceneImageUrl ?? null,
      evidenceRenders: patch.evidenceRenders ?? media?.evidenceRenders ?? null,
      evidenceModels: patch.evidenceModels ?? media?.evidenceModels ?? null,
    };
  },
});
