import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

const staticPublicCase = {
  case_id: 'CS-2026-0509-001',
  title: 'The Marina One Penthouse',
  victim: {
    name: 'Raymond Teo',
    age: 47,
    occupation: 'Property developer',
    time_of_death: '02:47 SGT',
    location: 'Marina One, Penthouse 47-B, Singapore',
    date: '2026-05-09',
  },
  witnesses: [
    {
      id: 'w_marcus',
      name: 'Marcus Lim',
      role: 'Building concierge',
      age: 34,
      knows:
        'Saw Priya leave the lobby at 03:12, much later than her usual departure.',
      hiding:
        'Was asleep at his desk between 01:30 and 02:30 and is afraid of losing his job.',
      lies: false,
      voice_id: 'pNInz6obpgDQGcFmaJgB',
      portrait_prompt:
        'Singaporean man in his mid-30s, navy concierge uniform, polite but tired eyes',
    },
    {
      id: 'w_priya',
      name: 'Priya Naidu',
      role: 'Personal assistant to the victim',
      age: 29,
      knows:
        'Knows the full schedule, access codes, and that Raymond had pulled wire-transfer logs.',
      hiding: 'Embezzlement of S$340,000 over eight months. The murder itself.',
      lies: true,
      voice_id: 'EXAVITQu4vr4xnSDxMaL',
      portrait_prompt:
        'Singaporean Indian woman, late 20s, sharp blazer, composed but eyes that do not settle',
    },
    {
      id: 'w_eleanor',
      name: 'Eleanor Teo',
      role: 'Estranged wife',
      age: 44,
      knows:
        'Raymond mentioned a staff problem he was finally going to deal with this week.',
      hiding:
        'A pending divorce filing she planned to serve on Monday, unrelated to the death.',
      lies: false,
      voice_id: 'ThT5KcBeYPX3keUQqHPh',
      portrait_prompt:
        'Singaporean Chinese woman, mid-40s, cream blouse, controlled grief',
    },
  ],
  clues: [
    'Tumbler on the nightstand contains residue of a benzodiazepine not prescribed to the victim.',
    'Penthouse access log shows door opened from the inside at 02:51, three minutes after estimated TOD.',
    'A second wine glass in the kitchen sink -- lipstick on rim matches no one in the building.',
  ],
  scene_prompt:
    'Top-down forensic photograph of a luxury Singapore penthouse bedroom at night, single male victim on a king-size bed, silk pillow displaced beside him, half-empty tumbler on nightstand.',
  brief:
    'Raymond Teo, 47, founder of Teo Holdings, was found unresponsive in the master bedroom of his Marina One penthouse at 04:22 by his housekeeper.',
};

const staticHiddenTruth = {
  killer: 'w_priya',
  motive:
    'Raymond was about to fire her and report unauthorised wire transfers she had made to cover family debts.',
  method:
    'Sedative slipped into the victim’s nightcap, then suffocation with a silk pillow once he was unconscious.',
  hidden_clue:
    'A deleted calendar entry titled "P. -- termination + audit" scheduled for 09:00 the morning of the death.',
};

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

export const startNewCase = mutation({
  args: {},
  handler: async (ctx) => {
    const timestamp = Date.now();
    const caseId = await ctx.db.insert('cases', {
      caseId: staticPublicCase.case_id,
      title: staticPublicCase.title,
      publicCase: staticPublicCase,
      hiddenTruth: staticHiddenTruth,
      generation: {
        model: 'static-fallback',
        promptVersion: 'v0',
        generationMs: 8300,
        createdAt: timestamp,
      },
    });
    await ctx.db.insert('media', { caseId, updatedAt: timestamp });

    for (const witness of staticPublicCase.witnesses) {
      await ctx.db.insert('witnesses', {
        caseId,
        witnessId: witness.id,
        publicProfile: witness,
        hiddenFacts: { hiding: witness.hiding, lies: witness.lies },
        voiceId: witness.voice_id,
        lieStrategy: witness.lies
          ? 'Deny returning to the penthouse until confronted with access logs.'
          : undefined,
      });
    }

    return await ctx.db.insert('sessions', {
      caseId,
      phase: 'CASE_BRIEF',
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  },
});
