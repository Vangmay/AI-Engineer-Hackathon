import { mutation } from './_generated/server';
import { v } from 'convex/values';

interface PublicWitness {
  id: string;
  name: string;
}

interface PublicCase {
  victim: { name: string };
  witnesses: PublicWitness[];
}

interface HiddenTruth {
  killer: string;
  motive: string;
  method: string;
  hidden_clue: string;
}

interface CaseDocForReveal {
  publicCase: PublicCase;
  hiddenTruth: HiddenTruth;
}

function buildReveal(caseDoc: CaseDocForReveal, correct: boolean) {
  const publicCase = caseDoc.publicCase;
  const truth = caseDoc.hiddenTruth;
  const killer = publicCase.witnesses.find(
    (w: { id: string }) => w.id === truth.killer,
  );
  const killerName = killer?.name ?? 'Unknown';
  if (correct) {
    return `Case closed. ${killerName} killed ${publicCase.victim.name}. ${truth.motive} ${truth.method} The hidden detail you may have missed: ${truth.hidden_clue}`;
  }
  return `Wrong call. The killer was ${killerName}. ${truth.motive} ${truth.method} What you missed: ${truth.hidden_clue}`;
}

export const evaluateAccusation = mutation({
  args: {
    sessionId: v.id('sessions'),
    accusationText: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error('Session not found');
    const caseDoc = await ctx.db.get(session.caseId);
    if (!caseDoc) throw new Error('Case not found');

    const truth = caseDoc.hiddenTruth as HiddenTruth;
    const publicCase = caseDoc.publicCase as PublicCase;
    const killer = publicCase.witnesses.find(
      (w: { id: string }) => w.id === truth.killer,
    );
    const firstName = killer?.name.toLowerCase().split(' ')[0] ?? '';
    const isCorrect = args.accusationText.toLowerCase().includes(firstName);
    const revealNarration = buildReveal(
      { publicCase, hiddenTruth: truth },
      isCorrect,
    );

    await ctx.db.patch(args.sessionId, {
      phase: 'REVEAL',
      accusation: args.accusationText,
      isCorrect,
      revealNarration,
      updatedAt: Date.now(),
    });

    return { isCorrect, revealNarration };
  },
});
