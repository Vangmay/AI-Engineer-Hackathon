import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

const audioKind = v.union(
  v.literal('intro'),
  v.literal('default'),
  v.literal('sample'),
  v.literal('call911'),
  v.literal('reveal'),
  v.literal('ambient'),
  v.literal('other'),
);

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
        .withIndex('by_case_asset_key', (q) => q.eq('caseId', args.caseId).eq('assetKey', asset.assetKey))
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
        .withIndex('by_case_witness', (q) => q.eq('caseId', args.caseId).eq('witnessId', witnessId))
        .first();
      if (!witness) continue;
      await ctx.db.patch(witness._id, witnessPatch);
    }

    return {
      caseId: args.caseId,
      storedCount,
      witnessCount: witnessPatches.size,
      mediaUpdated: Boolean(
        mediaPatch.call911AudioUrl || mediaPatch.revealNarrationAudioUrl || mediaPatch.ambientAudioUrl,
      ),
    };
  },
});
