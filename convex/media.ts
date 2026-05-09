import { action, internalMutation, internalQuery, mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { internal } from './_generated/api';

const audioKind = v.union(
  v.literal('intro'),
  v.literal('default'),
  v.literal('sample'),
  v.literal('call911'),
  v.literal('reveal'),
  v.literal('ambient'),
  v.literal('other'),
);

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

interface FalImageResponse {
  images?: Array<{ url?: string }>;
}

const mediaInternals = internal.media as {
  getCaseDoc: unknown;
  getMediaDoc: unknown;
  patchMedia: unknown;
};

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

export const generateForCase = action({
  args: {
    caseId: v.id('cases'),
    force: v.optional(v.boolean()),
    sceneImageUrl: v.optional(v.string()),
    evidenceRenders: v.optional(v.any()),
    evidenceModels: v.optional(v.any()),
    evidenceModelPreviews: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const [media, caseDoc]: [
      | {
          sceneImageUrl?: string;
          evidenceRenders?: unknown;
          evidenceModels?: unknown;
          evidenceModelPreviews?: unknown;
        }
      | null,
      | {
          title: string;
          publicCase: { scene_prompt?: string };
        }
      | null,
    ] = await Promise.all([
      ctx.runQuery(mediaInternals.getMediaDoc as any, { caseId: args.caseId } as any),
      ctx.runQuery(mediaInternals.getCaseDoc as any, { caseId: args.caseId } as any),
    ]);

    if (!caseDoc) throw new Error(`Case ${args.caseId} not found`);

    const patch: Record<string, unknown> = {};

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
      await ctx.runMutation(mediaInternals.patchMedia as any, {
        caseId: args.caseId,
        ...patch,
      } as any);
    }

    return {
      sceneImageUrl: (patch.sceneImageUrl as string | undefined) ?? media?.sceneImageUrl ?? null,
      evidenceRenders: patch.evidenceRenders ?? media?.evidenceRenders ?? null,
      evidenceModels: patch.evidenceModels ?? media?.evidenceModels ?? null,
    };
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const listCaseAudioAssets = query({
  args: { caseId: v.id('cases') },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query('audioAssets')
      .withIndex('by_case', (q) => q.eq('caseId', args.caseId))
      .collect();

    return rows.map((row) => ({
      assetKey: row.assetKey,
      kind: row.kind,
      witnessId: row.witnessId,
      characterRole: row.characterRole,
      url: row.url,
    }));
  },
});

export const saveUploadedAudioAssets = mutation({
  args: {
    caseId: v.id('cases'),
    assets: v.array(
      v.object({
        assetKey: v.string(),
        kind: audioKind,
        storageId: v.id('_storage'),
        witnessId: v.optional(v.string()),
        characterRole: v.optional(v.string()),
        renderText: v.optional(v.string()),
        sourceAssetId: v.optional(v.string()),
        providerVoiceId: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const caseDoc = await ctx.db.get(args.caseId);
    if (!caseDoc) {
      throw new Error(`Case ${args.caseId} not found.`);
    }

    const mediaDoc =
      (await ctx.db
        .query('media')
        .withIndex('by_case', (q) => q.eq('caseId', args.caseId))
        .first()) ??
      ({
        _id: await ctx.db.insert('media', {
          caseId: args.caseId,
          updatedAt: now,
        }),
      } as const);

    const mediaPatch: {
      call911AudioUrl?: string;
      revealNarrationAudioUrl?: string;
      ambientAudioUrl?: string;
      updatedAt: number;
    } = { updatedAt: now };
    const witnessPatches = new Map<
      string,
      {
        introAudioUrl?: string;
        defaultAnswerAudioUrl?: string;
        sampleAudioUrl?: string;
      }
    >();

    let storedCount = 0;

    for (const asset of args.assets) {
      const url = await ctx.storage.getUrl(asset.storageId);
      if (!url) continue;

      const existingAsset = await ctx.db
        .query('audioAssets')
        .withIndex('by_case_asset_key', (q) =>
          q.eq('caseId', args.caseId).eq('assetKey', asset.assetKey),
        )
        .first();

      const payload = {
        caseId: args.caseId,
        assetKey: asset.assetKey,
        kind: asset.kind,
        storageId: asset.storageId,
        url,
        witnessId: asset.witnessId,
        characterRole: asset.characterRole,
        renderText: asset.renderText,
        sourceAssetId: asset.sourceAssetId,
        providerVoiceId: asset.providerVoiceId,
        updatedAt: now,
      };

      if (existingAsset) {
        await ctx.db.patch(existingAsset._id, payload);
      } else {
        await ctx.db.insert('audioAssets', payload);
      }
      storedCount += 1;

      if (asset.kind === 'call911') mediaPatch.call911AudioUrl = url;
      if (asset.kind === 'reveal') mediaPatch.revealNarrationAudioUrl = url;
      if (asset.kind === 'ambient') mediaPatch.ambientAudioUrl = url;

      if (asset.witnessId) {
        const witnessPatch = witnessPatches.get(asset.witnessId) ?? {};
        if (asset.kind === 'intro') witnessPatch.introAudioUrl = url;
        if (asset.kind === 'default') witnessPatch.defaultAnswerAudioUrl = url;
        if (asset.kind === 'sample') witnessPatch.sampleAudioUrl = url;
        witnessPatches.set(asset.witnessId, witnessPatch);
      }
    }

    await ctx.db.patch(mediaDoc._id, mediaPatch);

    for (const [witnessId, witnessPatch] of witnessPatches) {
      const witness = await ctx.db
        .query('witnesses')
        .withIndex('by_case_witness', (q) =>
          q.eq('caseId', args.caseId).eq('witnessId', witnessId),
        )
        .first();
      if (!witness) continue;
      await ctx.db.patch(witness._id, witnessPatch);
    }

    return {
      caseId: args.caseId,
      storedCount,
      witnessCount: witnessPatches.size,
      mediaUpdated: Boolean(
        mediaPatch.call911AudioUrl ||
          mediaPatch.revealNarrationAudioUrl ||
          mediaPatch.ambientAudioUrl,
      ),
    };
  },
});
