import type { GameCasePackage } from '../types/gamePackage.ts';
import { raymondTeoCase } from './raymondTeoCase.ts';
import type { Witness } from '../types/case.ts';

const AUDIO_PLACEHOLDER_URI =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';

export const raymondTeoPackage: GameCasePackage = {
  packageId: 'pkg_case_raymond_teo_2026_v1',
  caseId: 'case_raymond_teo_2026',
  title: raymondTeoCase.title,
  runtimeCase: raymondTeoCase,
  witnessPromptPacks: raymondTeoCase.witnesses.map((witness: Witness) => ({
    witnessId: witness.id,
    systemPrompt: `You are ${witness.name}, the ${witness.role} in the ${raymondTeoCase.title} case. Stay in character, answer in 2-3 sentences, and never reveal the hidden truth directly.`,
    openingLine: `I'm ${witness.name}. Ask what you need to know.`,
    truthsTheyKnow: [witness.knows],
    secretsTheyHide: [witness.hiding],
    lieStrategy: witness.lies
      ? 'Deflect toward timing uncertainty and deny being present at the key moment.'
      : undefined,
  })),
  call911Script:
    'Operator, please send someone now. Mr. Teo is not moving and the bedroom looks wrong. I do not see blood, but something terrible has happened.',
  revealNarrationText: `The case turns on motive, access, and timing. ${raymondTeoCase.truth.motive} ${raymondTeoCase.truth.method}`,
  assetManifest: {
    sceneImageUri: undefined,
    witnessPortraits: Object.fromEntries(
      raymondTeoCase.witnesses.map((witness: Witness) => [witness.id, '']),
    ),
    voiceModels: {
      w_marcus: {
        voiceMode: 'profile_fallback',
        providerVoiceId: 'seed-marcus-voice',
        sampleAssetUri: AUDIO_PLACEHOLDER_URI,
      },
      w_priya: {
        voiceMode: 'profile_fallback',
        providerVoiceId: 'seed-priya-fallback',
        sampleAssetUri: AUDIO_PLACEHOLDER_URI,
      },
      w_eleanor: {
        voiceMode: 'profile_fallback',
        providerVoiceId: 'seed-eleanor-fallback',
        sampleAssetUri: AUDIO_PLACEHOLDER_URI,
      },
    },
    renderedAudio: {
      call911AudioUri: AUDIO_PLACEHOLDER_URI,
      revealNarrationAudioUri: AUDIO_PLACEHOLDER_URI,
      witnessIntroUris: Object.fromEntries(
        raymondTeoCase.witnesses.map((witness: Witness) => [witness.id, AUDIO_PLACEHOLDER_URI]),
      ),
      accusationResponseUris: {
        correct: AUDIO_PLACEHOLDER_URI,
        incorrect: AUDIO_PLACEHOLDER_URI,
      },
    },
  },
  packageVersion: '1.0.0',
  generatedAt: '2026-05-09T00:00:00.000Z',
};
