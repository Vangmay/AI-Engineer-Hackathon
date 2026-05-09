type VoiceGender = 'male' | 'female' | 'unknown';

const MALE_VOICE_IDS = [
  'pNInz6obpgDQGcFmaJgB',
] as const;

const FEMALE_VOICE_IDS = [
  'EXAVITQu4vr4xnSDxMaL',
  'ThT5KcBeYPX3keUQqHPh',
] as const;

const FEMALE_HINTS = [
  'she',
  'her',
  'woman',
  'female',
  'wife',
  'mother',
  'sister',
  'ms.',
  'mrs.',
] as const;

const MALE_HINTS = [
  'he',
  'him',
  'man',
  'male',
  'husband',
  'father',
  'brother',
  'mr.',
] as const;

const LIKELY_FEMALE_FIRST_NAMES = new Set([
  'carol',
  'erin',
  'jessica',
  'priya',
  'eleanor',
  'hae',
]);

const LIKELY_MALE_FIRST_NAMES = new Set([
  'russell',
  'graham',
  'colin',
  'adam',
  'jim',
  'marcus',
  'raymond',
  'adnan',
]);

function hashString(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) - h + input.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function containsAny(text: string, tokens: readonly string[]): boolean {
  const lower = text.toLowerCase();
  return tokens.some((token) => lower.includes(token));
}

export function inferVoiceGender(input: {
  name?: unknown;
  role?: unknown;
  profile?: unknown;
  persona?: unknown;
  gender?: unknown;
  genderPresentation?: unknown;
  sex?: unknown;
}): VoiceGender {
  const explicit =
    typeof input.gender === 'string'
      ? input.gender
      : typeof input.genderPresentation === 'string'
        ? input.genderPresentation
        : typeof input.sex === 'string'
          ? input.sex
          : '';
  const explicitLower = explicit.toLowerCase();
  if (explicitLower.includes('female') || explicitLower.includes('woman')) return 'female';
  if (explicitLower.includes('male') || explicitLower.includes('man')) return 'male';

  const merged = [
    typeof input.name === 'string' ? input.name : '',
    typeof input.role === 'string' ? input.role : '',
    typeof input.profile === 'string' ? input.profile : '',
    typeof input.persona === 'string' ? input.persona : '',
  ]
    .filter(Boolean)
    .join(' ');

  if (containsAny(merged, FEMALE_HINTS)) return 'female';
  if (containsAny(merged, MALE_HINTS)) return 'male';

  const name = typeof input.name === 'string' ? input.name.trim().toLowerCase() : '';
  const first = name.split(/\s+/)[0] ?? '';
  if (LIKELY_FEMALE_FIRST_NAMES.has(first)) return 'female';
  if (LIKELY_MALE_FIRST_NAMES.has(first)) return 'male';
  return 'unknown';
}

export function pickGenderAwareElevenVoiceId(args: {
  witnessId: string;
  preferredVoiceId?: string;
  gender: VoiceGender;
}): string {
  const preferred =
    args.preferredVoiceId && args.preferredVoiceId !== 'stub'
      ? args.preferredVoiceId.trim()
      : '';

  if (preferred) {
    // Only trust preferred IDs when they are known to be in the same gender pool.
    if (args.gender === 'female' && FEMALE_VOICE_IDS.includes(preferred as (typeof FEMALE_VOICE_IDS)[number])) {
      return preferred;
    }
    if (args.gender === 'male' && MALE_VOICE_IDS.includes(preferred as (typeof MALE_VOICE_IDS)[number])) {
      return preferred;
    }
  }
  if (args.gender === 'female') {
    return FEMALE_VOICE_IDS[hashString(args.witnessId) % FEMALE_VOICE_IDS.length]!;
  }
  if (args.gender === 'male') {
    return MALE_VOICE_IDS[hashString(args.witnessId) % MALE_VOICE_IDS.length]!;
  }
  const combined = [...MALE_VOICE_IDS, ...FEMALE_VOICE_IDS] as const;
  return combined[hashString(args.witnessId) % combined.length]!;
}

export function pickGenderAwareOpenAiVoice(gender: VoiceGender): string {
  if (gender === 'female') return process.env.OPENAI_TTS_VOICE_FEMALE?.trim() || 'nova';
  if (gender === 'male') return process.env.OPENAI_TTS_VOICE_MALE?.trim() || 'onyx';
  return process.env.OPENAI_TTS_VOICE?.trim() || 'alloy';
}
