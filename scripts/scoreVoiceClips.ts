import type { MediaCandidate } from '../src/types/media.ts';
import { loadCaseBundle, saveCaseBundle } from './lib/caseFiles.ts';
import { parseArgs } from './lib/cli.ts';
import { loadLocalEnv } from './lib/env.ts';
import { rootDir } from './lib/paths.ts';
import { computeCloneUsabilityScore } from './lib/scoring.ts';

function scoreClip(entry: MediaCandidate): MediaCandidate {
  if (entry.mediaKind === 'image') return entry;

  const signalQuality = Math.max(
    0,
    Math.min(100, (entry.voiceIsolatedScore ?? 0) - (entry.backgroundNoiseScore ?? 0) / 2),
  );
  const personCertainty = entry.speakerConfidence ?? 60;
  const transcriptRichness = entry.transcriptAvailable ? 75 : 40;
  const sourceCredibility = entry.sourceIds.length > 0 ? 75 : 40;
  const usableForCloneScore = computeCloneUsabilityScore({
    signalQuality,
    personCertainty,
    transcriptRichness,
    sourceCredibility,
  });

  let voiceCloneEligibility: MediaCandidate['voiceCloneEligibility'] = 'reject';
  if (
    (entry.speechDurationSec ?? 0) >= 60 &&
    (entry.voiceIsolatedScore ?? 0) >= 75 &&
    (entry.overlapRatio ?? 1) <= 0.2 &&
    usableForCloneScore >= 75
  ) {
    voiceCloneEligibility = 'eligible';
  } else if (usableForCloneScore >= 55) {
    voiceCloneEligibility = 'fallback_only';
  }

  return {
    ...entry,
    usableForCloneScore,
    voiceCloneEligibility,
  };
}

async function main() {
  loadLocalEnv(rootDir);
  const args = parseArgs(process.argv.slice(2));
  const caseId = args.caseId;
  if (!caseId) {
    throw new Error('Usage: npm run score-voice-clips -- --caseId=<caseId>');
  }

  const bundle = loadCaseBundle(caseId);
  const media = bundle.media.map(scoreClip);
  saveCaseBundle(caseId, { media });
  console.log(`Scored voice clips for ${caseId}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
