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
  sceneImageUri?: string;
  witnessPortraits: Record<string, string>;
  voiceModels: Record<
    string,
    {
      voiceMode: 'real_clone' | 'profile_fallback';
      providerVoiceId?: string;
      sampleAssetUri?: string;
    }
  >;
  renderedAudio: {
    call911AudioUri?: string;
    revealNarrationAudioUri?: string;
    witnessIntroUris: Record<string, string>;
    accusationResponseUris?: Record<string, string>;
    ambientOrStingUris?: Record<string, string>;
  };
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
