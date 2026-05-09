import { mutation } from './_generated/server';
import { v } from 'convex/values';

function toTimestamp(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

export const upsertGamePackage = mutation({
  args: {
    packageRecord: v.any(),
    caseRecord: v.any(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const pkg = args.packageRecord as {
      caseId: string;
      title?: string;
      packageVersion?: string;
      generatedAt?: string;
      runtimeCase: {
        case_id: string;
        title: string;
        truth: unknown;
        witnesses: Array<{
          id: string;
          hiding?: string;
          lies?: boolean;
          voice_id?: string;
          [key: string]: unknown;
        }>;
        [key: string]: unknown;
      };
      call911Script?: string;
      revealNarrationText?: string;
      witnessPromptPacks?: Array<{
        witnessId: string;
        truthsTheyKnow?: string[];
        secretsTheyHide?: string[];
        lieStrategy?: string;
      }>;
      assetManifest?: {
        voiceModels?: Record<string, { providerVoiceId?: string }>;
      };
    };
    const caseRecord = args.caseRecord as {
      caseId?: string;
      canonicalTitle?: string;
      createdAt?: string;
      updatedAt?: string;
    };

    const publicCase = {
      ...pkg.runtimeCase,
      call911Script: pkg.call911Script,
      revealNarrationText: pkg.revealNarrationText,
    };
    const stringCaseId = caseRecord.caseId ?? pkg.caseId ?? pkg.runtimeCase.case_id;

    const existingCase = await ctx.db
      .query('cases')
      .withIndex('by_case_id', (q) => q.eq('caseId', stringCaseId))
      .first();

    const generation = {
      model: 'package-import',
      promptVersion: pkg.packageVersion ?? '1.0.0',
      createdAt: toTimestamp(pkg.generatedAt ?? caseRecord.createdAt, now),
    };

    const caseDocId =
      existingCase?._id ??
      (await ctx.db.insert('cases', {
        caseId: stringCaseId,
        title: pkg.title ?? caseRecord.canonicalTitle ?? pkg.runtimeCase.title,
        publicCase,
        hiddenTruth: pkg.runtimeCase.truth,
        generation,
      }));

    if (existingCase) {
      await ctx.db.patch(existingCase._id, {
        title: pkg.title ?? caseRecord.canonicalTitle ?? pkg.runtimeCase.title,
        publicCase,
        hiddenTruth: pkg.runtimeCase.truth,
        generation,
      });
    }

    const existingMedia = await ctx.db
      .query('media')
      .withIndex('by_case', (q) => q.eq('caseId', caseDocId))
      .first();
    if (!existingMedia) {
      await ctx.db.insert('media', { caseId: caseDocId, updatedAt: now });
    }

    const promptPacks = new Map(
      (pkg.witnessPromptPacks ?? []).map((pack) => [pack.witnessId, pack]),
    );
    const voiceModels = pkg.assetManifest?.voiceModels ?? {};

    for (const witness of pkg.runtimeCase.witnesses) {
      const existingWitness = await ctx.db
        .query('witnesses')
        .withIndex('by_case_witness', (q) => q.eq('caseId', caseDocId).eq('witnessId', witness.id))
        .first();
      const promptPack = promptPacks.get(witness.id);

      const patch = {
        publicProfile: witness,
        hiddenFacts: {
          hiding: witness.hiding,
          lies: witness.lies,
          truthsTheyKnow: promptPack?.truthsTheyKnow ?? [],
          secretsTheyHide: promptPack?.secretsTheyHide ?? [],
        },
        voiceId: voiceModels[witness.id]?.providerVoiceId ?? witness.voice_id ?? '',
        lieStrategy: promptPack?.lieStrategy,
      };

      if (existingWitness) {
        await ctx.db.patch(existingWitness._id, patch);
      } else {
        await ctx.db.insert('witnesses', {
          caseId: caseDocId,
          witnessId: witness.id,
          ...patch,
        });
      }
    }

    return {
      caseId: caseDocId,
      stringCaseId,
      witnessCount: pkg.runtimeCase.witnesses.length,
      updatedAt: toTimestamp(caseRecord.updatedAt, now),
    };
  },
});
