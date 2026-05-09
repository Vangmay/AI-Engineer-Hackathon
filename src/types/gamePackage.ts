import type { MysteryCase } from './case.ts';

export interface WitnessPromptPack {
  witnessId: string;
  systemPrompt: string;
  openingLine: string;
  truthsTheyKnow: string[];
  secretsTheyHide: string[];
  lieStrategy?: string;
}

export interface AssetManifest {
  sceneImageUri?: string | null;
  sceneModelUri?: string | null;
  call911AudioUri?: string | null;
  revealNarrationAudioUri?: string | null;
  witnessPortraits: Record<string, string>;
  witnessVoiceSamples: Record<string, string>;
  voiceModels: Record<
    string,
    {
      voiceMode: 'real_clone' | 'profile_fallback';
      providerVoiceId?: string;
      sampleAssetUri?: string | null;
    }
  >;
  renderedAudio: {
    call911AudioUri?: string;
    revealNarrationAudioUri?: string;
    witnessIntroUris: Record<string, string>;
    accusationResponseUris?: Record<string, string>;
    ambientOrStingUris?: Record<string, string>;
  };
  evidenceRenders?: Record<string, string>;
  evidenceModels?: Record<string, string>;
  evidenceModelPreviews?: Record<string, string>;
}

export interface GameCasePackage {
  packageId: string;
  caseId: string;
  title: string;
  runtimeCase: MysteryCase;
  witnessPromptPacks: WitnessPromptPack[];
  call911Script: string;
  revealNarrationText: string;
  assetManifest: AssetManifest;
  packageVersion: string;
  generatedAt: string;
}
