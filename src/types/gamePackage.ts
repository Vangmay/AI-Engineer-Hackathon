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
  call911AudioUri?: string;
  revealNarrationAudioUri?: string;
  witnessPortraits: Record<string, string>;
  witnessVoiceSamples: Record<string, string>;
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
