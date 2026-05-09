import { action, internalMutation, internalQuery, mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { api, internal } from './_generated/api';
import { normalize911Transcript, type GeneratedPublicCase } from './caseEngine';

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

function build911SpeechScript(pub: GeneratedPublicCase): string {
  const lines = pub.call911_transcript ?? [];
  return lines
    .map((line) => {
      const role = line.who === 'DISP' ? 'Emergency dispatcher' : '911 caller';
      return `${role}:\n${line.text}`;
    })
    .join('\n\n')
    .slice(0, 3900);
}

async function synthOpenAiTtsMp3(openaiKey: string | undefined, input: string): Promise<ArrayBuffer | null> {
  if (!openaiKey?.trim()) return null;
  const text = sanitisePrompt(input).trim().slice(0, 3900);
  if (!text) return null;

  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${openaiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'tts-1',
      voice: 'nova',
      input: text,
      response_format: 'mp3',
    }),
  });

  if (!response.ok) {
    console.error('[media] openai TTS:', response.status, await response.text());
    return null;
  }

  return response.arrayBuffer();
}

async function synthElevenLabsMp3(
  elevenKey: string,
  voiceId: string,
  input: string,
  modelId: string,
): Promise<ArrayBuffer | null> {
  const text = sanitisePrompt(input).trim().slice(0, 2500);
  if (!elevenKey || !voiceId || !text) return null;

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'xi-api-key': elevenKey,
      },
      body: JSON.stringify({ text, model_id: modelId }),
    },
  );

  if (!response.ok) {
    console.error('[media] ElevenLabs TTS:', response.status, await response.text());
    return null;
  }

  return response.arrayBuffer();
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

export const listWitnessRowsForCase = internalQuery({
  args: { caseId: v.id('cases') },
  handler: async (ctx, args) =>
    ctx.db
      .query('witnesses')
      .withIndex('by_case', (q) => q.eq('caseId', args.caseId))
      .collect(),
});

export const linkCall911AudioFromStorage = internalMutation({
  args: {
    caseId: v.id('cases'),
    storageId: v.id('_storage'),
  },
  handler: async (ctx, args) => {
    const url = await ctx.storage.getUrl(args.storageId);
    if (!url) return;

    const mediaDoc = await ctx.db
      .query('media')
      .withIndex('by_case', (q) => q.eq('caseId', args.caseId))
      .first();
    if (!mediaDoc) {
      await ctx.db.insert('media', {
        caseId: args.caseId,
        call911AudioUrl: url,
        updatedAt: Date.now(),
      });
      return;
    }
    await ctx.db.patch(mediaDoc._id, { call911AudioUrl: url, updatedAt: Date.now() });
  },
});

export const linkWitnessIntroFromStorage = internalMutation({
  args: {
    caseId: v.id('cases'),
    witnessId: v.string(),
    storageId: v.id('_storage'),
  },
  handler: async (ctx, args) => {
    const url = await ctx.storage.getUrl(args.storageId);
    if (!url) return;

    const row = await ctx.db
      .query('witnesses')
      .withIndex('by_case_witness', (q) =>
        q.eq('caseId', args.caseId).eq('witnessId', args.witnessId),
      )
      .first();
    if (!row) return;
    await ctx.db.patch(row._id, { introAudioUrl: url });
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

/** Single round-trip for lobby polling: scene, 911 audio, witness intro URLs, evidence maps. */
export const getLobbyMediaHydration = query({
  args: { dossierSlug: v.string() },
  handler: async (ctx, args) => {
    const caseRow = await ctx.db
      .query('cases')
      .withIndex('by_case_id', (q) => q.eq('caseId', args.dossierSlug))
      .first();
    if (!caseRow) return null;

    const [mediaDoc, witnessRows] = await Promise.all([
      ctx.db
        .query('media')
        .withIndex('by_case', (q) => q.eq('caseId', caseRow._id))
        .first(),
      ctx.db
        .query('witnesses')
        .withIndex('by_case', (q) => q.eq('caseId', caseRow._id))
        .collect(),
    ]);

    const witnessIntroAudioUrls: Record<string, string> = {};
    for (const w of witnessRows) {
      if (w.introAudioUrl) witnessIntroAudioUrls[w.witnessId] = w.introAudioUrl;
    }

    return {
      sceneImageUrl: mediaDoc?.sceneImageUrl ?? null,
      call911AudioUrl: mediaDoc?.call911AudioUrl ?? null,
      witnessIntroAudioUrls,
      evidenceImageUrls: (mediaDoc?.evidenceRenders as Record<string, string> | undefined) ?? {},
      evidenceModels: (mediaDoc?.evidenceModels as Record<string, string> | undefined) ?? {},
      evidenceModelPreviewUrls: (mediaDoc?.evidenceModelPreviews as Record<string, string> | undefined) ?? {},
    };
  },
});

type GenerateForCaseResult = {
  sceneImageUrl: string | null;
  evidenceRenders: unknown;
  evidenceModels: unknown;
};

export const generateForCase = action({
  args: {
    caseId: v.id('cases'),
    force: v.optional(v.boolean()),
    /** When true, only run TTS + storage linking (911 + witness intros)—no scene FAL/evidence patching. */
    speechOnly: v.optional(v.boolean()),
    sceneImageUrl: v.optional(v.string()),
    evidenceRenders: v.optional(v.any()),
    evidenceModels: v.optional(v.any()),
    evidenceModelPreviews: v.optional(v.any()),
  },
  handler: async (ctx, args): Promise<GenerateForCaseResult> => {
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

    if (!args.speechOnly) {
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
    }

    const refreshedMedia =
      (await ctx.runQuery(mediaInternals.getMediaDoc as any, {
        caseId: args.caseId,
      } as any)) ?? media;

    const openAi = process.env.OPENAI_API_KEY?.trim();
    const eleven = process.env.ELEVENLABS_API_KEY?.trim();
    const elevenModel = process.env.ELEVENLABS_MODEL_ID ?? 'eleven_multilingual_v2';
    const call911FallbackVoice =
      process.env.ELEVENLABS_CALL911_VOICE_ID ?? 'pNInz6obpgDQGcFmaJgB';

    const pubClone =
      JSON.parse(JSON.stringify(caseDoc.publicCase ?? {})) as GeneratedPublicCase;
    normalize911Transcript(pubClone);

    const shouldSynth =
      !!(openAi || eleven) &&
      pubClone.victim &&
      Array.isArray(pubClone.call911_transcript) &&
      pubClone.call911_transcript.length > 0;

    if (shouldSynth) {
      const script911 = build911SpeechScript(pubClone);
      const need911 = args.force || !refreshedMedia?.call911AudioUrl;

      if (need911 && script911.trim()) {
        let buf: ArrayBuffer | null = null;
        if (eleven) {
          buf = await synthElevenLabsMp3(eleven, call911FallbackVoice, script911, elevenModel);
        }
        if (!buf?.byteLength && openAi) {
          buf = await synthOpenAiTtsMp3(openAi, script911);
        }
        if (buf?.byteLength) {
          const storageId = await ctx.storage.store(
            new Blob([new Uint8Array(buf)], { type: 'audio/mpeg' }),
          );
          await ctx.runMutation(internal.media.linkCall911AudioFromStorage, {
            caseId: args.caseId,
            storageId,
          });
        }
      }

      const witnessRows = await ctx.runQuery(internal.media.listWitnessRowsForCase, {
        caseId: args.caseId,
      });

      await Promise.all(
        witnessRows.map(async (row) => {
          if ((!args.force && row.introAudioUrl?.trim()) || !(openAi || eleven)) return;

          const profile = row.publicProfile as {
            name?: string;
            role?: string;
            knows?: string;
          };
          const introText = `Interview room. Recording is live. You open first.\nI'm ${profile.name ?? 'the witness'}, ${profile.role ?? 'present at the scene'}.\nWhat you need to know from me: ${String(profile.knows ?? '').slice(0, 900)}`.slice(
            0,
            2400,
          );

          const voiceId =
            typeof row.voiceId === 'string' &&
            row.voiceId.trim() !== '' &&
            row.voiceId !== 'stub'
              ? row.voiceId
              : call911FallbackVoice;

          let introBuf: ArrayBuffer | null = null;
          if (eleven) {
            introBuf = await synthElevenLabsMp3(eleven, voiceId, introText, elevenModel);
          }
          if (!introBuf?.byteLength && openAi) {
            introBuf = await synthOpenAiTtsMp3(openAi, introText);
          }

          if (!introBuf?.byteLength) return;

          const introStorageId = await ctx.storage.store(
            new Blob([new Uint8Array(introBuf)], { type: 'audio/mpeg' }),
          );
          await ctx.runMutation(internal.media.linkWitnessIntroFromStorage, {
            caseId: args.caseId,
            witnessId: row.witnessId,
            storageId: introStorageId,
          });
        }),
      );
    }

    const finalMedia =
      (await ctx.runQuery(mediaInternals.getMediaDoc as any, {
        caseId: args.caseId,
      } as any)) ?? refreshedMedia;

    return {
      sceneImageUrl: (patch.sceneImageUrl as string | undefined) ?? finalMedia?.sceneImageUrl ?? null,
      evidenceRenders: patch.evidenceRenders ?? finalMedia?.evidenceRenders ?? null,
      evidenceModels: patch.evidenceModels ?? finalMedia?.evidenceModels ?? null,
    };
  },
});

/** When URLs are missing, synthesize via ElevenLabs-first pipeline and store like `generateForCase`. */
export const ensureSpeechIfMissingForSlug = action({
  args: {
    dossierSlug: v.string(),
    force: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const eleven = process.env.ELEVENLABS_API_KEY?.trim();
    const openAi = process.env.OPENAI_API_KEY?.trim();
    if (!eleven && !openAi) {
      return { ok: false as const, reason: 'no_tts_providers' };
    }

    const row = await ctx.runQuery(api.cases.getCaseBySlug, {
      slug: args.dossierSlug,
    });
    if (!row?._id) return { ok: false as const, reason: 'case_not_found' };

    const [mediaDoc, witnessRows] = await Promise.all([
      ctx.runQuery(api.media.getMediaForCase, { caseId: row._id }),
      ctx.runQuery(internal.media.listWitnessRowsForCase, { caseId: row._id }),
    ]);

    const force = Boolean(args.force);
    const need911 = force || !mediaDoc?.call911AudioUrl?.trim();
    const needIntro =
      force ||
      witnessRows.some((w) => !w.introAudioUrl?.trim());

    if (!need911 && !needIntro) {
      return { ok: true as const, skipped: true as const };
    }

    await ctx.runAction(api.media.generateForCase, {
      caseId: row._id,
      speechOnly: true,
      force,
    });

    return { ok: true as const, synthesized: true as const };
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
