import { action, internalMutation, internalQuery, mutation, query } from './_generated/server';
import type { Doc } from './_generated/dataModel';
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

/** OpenAI image moderation is stricter than chat; scrub crime-doc / LE language from the assembled prompt. */
function sanitisePromptForOpenAiImage(text: string): string {
  let out = sanitisePrompt(text);
  const imageExtra: Array<[RegExp, string]> = [
    [/\bsingapore\s+police(\s+force)?\b/gi, 'fiction department'],
    [/\bpolice(\s+(force|service|department))?\b/gi, 'fiction department'],
    [/\bcid\b/gi, ''],
    [/\bforensic\w*\b/gi, 'measuring-room'],
    [/\bevidence(\s+(board|marker|markers|tag|tape))?\b/gi, 'numbered story props'],
    [/\bmugshot\b/gi, 'headshot'],
    [/\bwitness\b/gi, 'named character'],
    [/\bhomicide\s+squad\b/gi, 'story writers room'],
    [/\bdetective\b/gi, 'inspector character'],
    [/\bsuspect\b/gi, 'participant'],
    [/\bcrime\s*scene\b/gi, 'story scene'],
    [/\bdossier\b/gi, 'story packet'],
    [/\b911\b/g, ' Dispatcher call'],
    [/\bdeath\b/gi, 'timed event'],
    [/\bkilling\b/gi, 'timed event'],
    [/\bwound\w*\b/gi, 'mark'],
    [/\bstab\w*\b/gi, 'marked'],
    [/\bshoot(ing)?\b/gi, 'movement'],
    [/\bgun\b/gi, 'metal object'],
    [/\bcorpse\b/gi, 'still figure'],
    [/\bnoir\b/gi, 'soft monochrome drama'],
    [/\binterrogation\b/gi, 'dialogue chapter'],
    [/\barrest\b/gi, 'meetup'],
    [/\briot\b/gi, 'crowd'],
  ];
  for (const [pattern, replacement] of imageExtra) {
    out = out.replace(pattern, replacement);
  }
  return out.replace(/\s{2,}/g, ' ').trim();
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
    'Fictional luxury high-rise penthouse apartment interior for a cozy narrative video game UI backdrop, tidy modern decor, subdued evening ambient light, wide establishing shot.',
    safe,
    'Architectural matte painting style, cozy calm mood, gentle shadows, no people, no gore, distress, weapons, drugs, injuries, silhouettes implying harm; no readable text or logos.',
  ].join(' ');
}

function buildEvidenceImagePrompt(clueText: string, caseTitle: string): string {
  const detail = sanitisePrompt(clueText.slice(0, 900));
  const titleSafe = sanitisePrompt(caseTitle.slice(0, 140));
  return [
    `Stylized tabletop prop photo for printable mystery party game cards, thematic title tag only "${titleSafe}" for inspiration (do not paint the words into the scene).`,
    detail,
    'Small everyday objects staged on beige linen, cork ruler for scale suggestion, pastel studio macro, whimsical board-game prop styling, upbeat mood, cute miniatures vibe, absolutely no firearms, knives, syringes, gore; no lettering or handwriting visible.',
  ].join(' ');
}

function buildWitnessPortraitImagePrompt(
  profile: {
    name?: string;
    role?: string;
    age?: number;
    portrait_prompt?: string;
  },
  caseTitle: string,
): string {
  const titleSafe = sanitisePrompt(caseTitle.slice(0, 140));
  const persona = sanitisePrompt(
    [
      profile.portrait_prompt,
      profile.name ? `Cast name label for writer reference only (do not spell in image): ${profile.name}` : '',
      profile.role ? `Fictional job flavor text: ${profile.role}` : '',
      typeof profile.age === 'number' ? `Likeness roughly inspired by adulthood around age ${profile.age}` : '',
    ]
      .filter(Boolean)
      .join(' ')
      .slice(0, 2000),
  );
  return [
    `Bright friendly illustrated NPC portrait splash for cozy mobile mystery game loosely inspired by storyline "${titleSafe}". Fully invented face, whimsical cartoon-realism hybrid, upbeat poster style.`,
    persona,
    'Chest-up framing, expressive eyes, flattering soft daylight, oatmeal studio backdrop, modern stylized illustration, approachable smile or neutral polite face, wholesome character design, pastel wardrobe, ABSOLUTE requirement: plain clothes only, NO uniforms badges IDs lanyards handcuffs courtroom settings law imagery; no captions or UI text burnt into frame.',
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

/** OpenAI Images API → PNG bytes (stored in Convex so we are not tied to expiring vendor URLs). */
async function openAiGenerateImagePngBuffer(
  prompt: string,
  apiKey: string,
  opts?: { size?: string },
): Promise<Uint8Array | null> {
  const model = process.env.OPENAI_IMAGE_MODEL?.trim() ?? 'dall-e-3';
  const safePrompt = sanitisePromptForOpenAiImage(prompt).trim().slice(0, 3800);
  if (!safePrompt) return null;

  const body: Record<string, unknown> = {
    model,
    prompt: safePrompt,
    n: 1,
    response_format: 'b64_json',
  };
  if (model === 'dall-e-3' || model.startsWith('dall-e')) {
    body.size =
      opts?.size?.trim() ??
      process.env.OPENAI_IMAGE_SIZE?.trim() ??
      '1792x1024';
    body.quality = process.env.OPENAI_IMAGE_QUALITY?.trim() ?? 'standard';
  }

  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    console.error('[media] OpenAI image:', res.status, await res.text());
    return null;
  }

  const data = (await res.json()) as { data?: Array<{ b64_json?: string }> };
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) return null;

  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
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
    witnessPortraitUrls: v.optional(v.any()),
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

export const linkSceneImageFromStorage = internalMutation({
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
        sceneImageUrl: url,
        updatedAt: Date.now(),
      });
      return;
    }
    await ctx.db.patch(mediaDoc._id, { sceneImageUrl: url, updatedAt: Date.now() });
  },
});

export const linkWitnessPortraitFromStorage = internalMutation({
  args: {
    caseId: v.id('cases'),
    witnessId: v.string(),
    storageId: v.id('_storage'),
  },
  handler: async (ctx, args) => {
    const url = await ctx.storage.getUrl(args.storageId);
    if (!url) return;

    const mediaDoc = await ctx.db
      .query('media')
      .withIndex('by_case', (q) => q.eq('caseId', args.caseId))
      .first();
    const prev = (mediaDoc?.witnessPortraitUrls as Record<string, string> | undefined) ?? {};
    const next = { ...prev, [args.witnessId]: url };

    if (!mediaDoc) {
      await ctx.db.insert('media', {
        caseId: args.caseId,
        witnessPortraitUrls: next,
        updatedAt: Date.now(),
      });
      return;
    }
    await ctx.db.patch(mediaDoc._id, { witnessPortraitUrls: next, updatedAt: Date.now() });
  },
});

export const linkEvidenceRenderFromStorage = internalMutation({
  args: {
    caseId: v.id('cases'),
    slotKey: v.string(),
    storageId: v.id('_storage'),
  },
  handler: async (ctx, args) => {
    const url = await ctx.storage.getUrl(args.storageId);
    if (!url) return;

    const mediaDoc = await ctx.db
      .query('media')
      .withIndex('by_case', (q) => q.eq('caseId', args.caseId))
      .first();
    const prev = (mediaDoc?.evidenceRenders as Record<string, string> | undefined) ?? {};
    const next = { ...prev, [args.slotKey]: url };

    if (!mediaDoc) {
      await ctx.db.insert('media', {
        caseId: args.caseId,
        evidenceRenders: next,
        updatedAt: Date.now(),
      });
      return;
    }
    await ctx.db.patch(mediaDoc._id, { evidenceRenders: next, updatedAt: Date.now() });
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
      witnessPortraitUrls: (mediaDoc?.witnessPortraitUrls as Record<string, string> | undefined) ?? {},
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
    /** If true, skip scene + evidence image generation. */
    speechOnly: v.optional(v.boolean()),
    /** If true, skip 911 and witness-intro TTS + storage linking. */
    visualsOnly: v.optional(v.boolean()),
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
          witnessPortraitUrls?: unknown;
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

    const openAiKey = process.env.OPENAI_API_KEY?.trim();

    const runVisualPatches = !args.speechOnly;
    const runSpeechPatches = !args.visualsOnly;
    const patch: Record<string, unknown> = {};

    if (runVisualPatches) {
      const falKey = process.env.FAL_API_KEY?.trim();
      const publicCase =
        JSON.parse(JSON.stringify(caseDoc.publicCase ?? {})) as GeneratedPublicCase;
      const clues = Array.isArray(publicCase.clues) ? publicCase.clues : [];

      if (args.sceneImageUrl && (!media?.sceneImageUrl || args.force)) {
        patch.sceneImageUrl = args.sceneImageUrl;
      } else if (!media?.sceneImageUrl || args.force) {
        const scenePromptFull = buildSceneImagePrompt(
          publicCase.scene_prompt ?? caseDoc.title,
        );
        let haveSceneUrl = false;
        if (falKey) {
          try {
            patch.sceneImageUrl = await falGenerateImage(scenePromptFull, falKey);
            haveSceneUrl = Boolean(String(patch.sceneImageUrl ?? '').trim());
          } catch (err) {
            console.error('[media] FAL crime-scene image failed:', err);
          }
        }
        if (!haveSceneUrl && openAiKey) {
          try {
            const png = await openAiGenerateImagePngBuffer(scenePromptFull, openAiKey);
            if (png?.length) {
              const copy = new Uint8Array(png.length);
              copy.set(png);
              const sid = await ctx.storage.store(new Blob([copy], { type: 'image/png' }));
              await ctx.runMutation(internal.media.linkSceneImageFromStorage, {
                caseId: args.caseId,
                storageId: sid,
              });
            }
          } catch (err) {
            console.error('[media] OpenAI crime-scene image failed:', err);
          }
        }
      }

      const baseRenders = (media?.evidenceRenders as Record<string, string> | undefined) ?? {};
      if (clues.length > 0 && (falKey || openAiKey)) {
        let rendersChanged = false;
        const nextRenders = { ...baseRenders };

        for (let i = 0; i < clues.length; i++) {
          const key = String(i);
          const clue = clues[i] ?? '';
          if (!args.force && nextRenders[key]?.trim()) continue;

          const evPrompt = buildEvidenceImagePrompt(clue, publicCase.title ?? caseDoc.title);

          if (falKey) {
            try {
              nextRenders[key] = await falGenerateImage(evPrompt, falKey);
              rendersChanged = true;
            } catch (err) {
              console.error('[media] evidence FAL image:', key, err);
            }
            continue;
          }

          if (openAiKey) {
            try {
              const png = await openAiGenerateImagePngBuffer(evPrompt, openAiKey);
              if (png?.length) {
                const copy = new Uint8Array(png.length);
                copy.set(png);
                const sid = await ctx.storage.store(new Blob([copy], { type: 'image/png' }));
                await ctx.runMutation(internal.media.linkEvidenceRenderFromStorage, {
                  caseId: args.caseId,
                  slotKey: key,
                  storageId: sid,
                });
              }
            } catch (err) {
              console.error('[media] evidence OpenAI image:', key, err);
            }
          }
        }

        if (rendersChanged) patch.evidenceRenders = nextRenders;
      }

      const witnessRowsForPortraits = await ctx.runQuery(internal.media.listWitnessRowsForCase, {
        caseId: args.caseId,
      });
      const basePortraitUrls =
        (media?.witnessPortraitUrls as Record<string, string> | undefined) ?? {};
      const portraitSquareSize =
        process.env.OPENAI_WITNESS_PORTRAIT_SIZE?.trim() ?? '1024x1024';

      if (openAiKey && witnessRowsForPortraits.length > 0) {
        await Promise.all(
          witnessRowsForPortraits.map(async (row: Doc<'witnesses'>) => {
            if (!args.force && basePortraitUrls[row.witnessId]?.trim()) return;

            const rawProfile = row.publicProfile as {
              name?: string;
              role?: string;
              age?: number;
              portrait_prompt?: string;
            };
            const profile = {
              ...rawProfile,
              portrait_prompt:
                typeof rawProfile.portrait_prompt === 'string' && rawProfile.portrait_prompt.trim()
                  ? rawProfile.portrait_prompt
                  : `${rawProfile.name ?? 'witness'}, noir documentary intake portrait`,
            };

            try {
              const fullPrompt = buildWitnessPortraitImagePrompt(
                profile,
                publicCase.title ?? caseDoc.title,
              );
              const png = await openAiGenerateImagePngBuffer(fullPrompt, openAiKey, {
                size: portraitSquareSize,
              });
              if (!png?.length) return;
              const copy = new Uint8Array(png.length);
              copy.set(png);
              const sid = await ctx.storage.store(new Blob([copy], { type: 'image/png' }));
              await ctx.runMutation(internal.media.linkWitnessPortraitFromStorage, {
                caseId: args.caseId,
                witnessId: row.witnessId,
                storageId: sid,
              });
            } catch (err) {
              console.error('[media] witness portrait OpenAI image:', row.witnessId, err);
            }
          }),
        );
      }

      if (args.evidenceRenders) {
        const autoBase =
          typeof patch.evidenceRenders === 'object' &&
          patch.evidenceRenders !== null &&
          !Array.isArray(patch.evidenceRenders)
            ? (patch.evidenceRenders as Record<string, string>)
            : baseRenders;
        patch.evidenceRenders = { ...autoBase, ...args.evidenceRenders };
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

    const eleven = process.env.ELEVENLABS_API_KEY?.trim();
    const elevenModel = process.env.ELEVENLABS_MODEL_ID ?? 'eleven_multilingual_v2';
    const call911FallbackVoice =
      process.env.ELEVENLABS_CALL911_VOICE_ID ?? 'pNInz6obpgDQGcFmaJgB';

    const pubClone =
      JSON.parse(JSON.stringify(caseDoc.publicCase ?? {})) as GeneratedPublicCase;
    normalize911Transcript(pubClone);

    // Do not require `victim`: normalize911Transcript() can fill a generic transcript when
    // victim fields are missing; gating on victim blocked 911 + witness TTS for those cases.
    const shouldSynth = runSpeechPatches && !!(openAiKey || eleven);

    if (shouldSynth) {
      const script911 = build911SpeechScript(pubClone);
      const need911 = args.force || !refreshedMedia?.call911AudioUrl;

      if (need911 && script911.trim()) {
        let buf: ArrayBuffer | null = null;
        if (eleven) {
          buf = await synthElevenLabsMp3(eleven, call911FallbackVoice, script911, elevenModel);
        }
        if (!buf?.byteLength && openAiKey) {
          buf = await synthOpenAiTtsMp3(openAiKey, script911);
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
        witnessRows.map(async (row: Doc<'witnesses'>) => {
          if ((!args.force && row.introAudioUrl?.trim()) || !(openAiKey || eleven)) return;

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
          if (!introBuf?.byteLength && openAiKey) {
            introBuf = await synthOpenAiTtsMp3(openAiKey, introText);
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

/**
 * Runs `generateForCase` with narrow flags based on whichever lobby assets Convex is missing:
 * visuals (FAL scene + clue stills), speech (911 + intros), or both.
 */
export const ensureLobbyMediaIfMissingForSlug = action({
  args: {
    dossierSlug: v.string(),
    force: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const row = await ctx.runQuery(api.cases.getCaseBySlug, {
      slug: args.dossierSlug,
    });
    if (!row?._id) return { ok: false as const, reason: 'case_not_found' };

    const [mediaDoc, witnessRows] = await Promise.all([
      ctx.runQuery(api.media.getMediaForCase, { caseId: row._id }),
      ctx.runQuery(internal.media.listWitnessRowsForCase, { caseId: row._id }),
    ]);

    const fal = process.env.FAL_API_KEY?.trim();
    const eleven = process.env.ELEVENLABS_API_KEY?.trim();
    const openAi = process.env.OPENAI_API_KEY?.trim();

    const force = Boolean(args.force);
    const pub = JSON.parse(JSON.stringify(row.publicCase ?? {})) as GeneratedPublicCase;
    const clues = Array.isArray(pub.clues) ? pub.clues : [];
    const renders = (mediaDoc?.evidenceRenders as Record<string, string> | undefined) ?? {};
    const portraitSlots =
      (mediaDoc?.witnessPortraitUrls as Record<string, string> | undefined) ?? {};

    const needScene = force || !mediaDoc?.sceneImageUrl?.trim();
    const needEvidenceSlots =
      clues.length > 0 &&
      (force ||
        clues.some((_, idx) => {
          const slot = renders[String(idx)]?.trim();
          return !slot;
        }));

    const needWitnessPortraits =
      openAi &&
      witnessRows.some((w: Doc<'witnesses'>) => force || !portraitSlots[w.witnessId]?.trim());

    const needsVisual = Boolean(
      (fal || openAi) && (needScene || needEvidenceSlots || needWitnessPortraits),
    );

    const need911 = force || !mediaDoc?.call911AudioUrl?.trim();
    const needIntro = force ||
      witnessRows.some((w: Doc<'witnesses'>) => !w.introAudioUrl?.trim());
    const needsSpeech = Boolean((eleven || openAi) && (need911 || needIntro));

    if (!needsVisual && !needsSpeech) {
      return { ok: true as const, skipped: true as const };
    }

    await ctx.runAction(api.media.generateForCase, {
      caseId: row._id,
      speechOnly: !needsVisual,
      visualsOnly: !needsSpeech,
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
