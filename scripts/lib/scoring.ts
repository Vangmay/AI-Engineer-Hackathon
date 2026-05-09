export function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function computePriorityScore(
  mysteryFitScore: number,
  documentationScore: number,
  mediaRichnessScore: number,
  castClarityScore: number,
): number {
  return clampScore(
    0.35 * mysteryFitScore +
      0.3 * documentationScore +
      0.2 * mediaRichnessScore +
      0.15 * castClarityScore,
  );
}

export function computeCloneUsabilityScore(input: {
  signalQuality: number;
  personCertainty: number;
  transcriptRichness: number;
  sourceCredibility: number;
}): number {
  const { signalQuality, personCertainty, transcriptRichness, sourceCredibility } = input;
  return clampScore(
    0.4 * signalQuality +
      0.3 * personCertainty +
      0.2 * transcriptRichness +
      0.1 * sourceCredibility,
  );
}
