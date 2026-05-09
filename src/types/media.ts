export type MediaKind = 'audio' | 'video' | 'image';

export type OriginType =
  | 'news_clip'
  | 'documentary'
  | 'interview'
  | 'mugshot'
  | 'courtroom'
  | 'archive_photo'
  | 'social'
  | 'other';

export type AssetType =
  | 'voice_model'
  | 'voice_line'
  | 'voice_fallback_profile'
  | 'portrait'
  | 'face_model'
  | 'animated_avatar'
  | 'case_image'
  | 'scene_model'
  | 'evidence_render'
  | 'evidence_model'
  | 'ambient_audio';

export type ToolProvider = 'elevenlabs' | 'fal' | 'openai' | 'manual';

export type ApprovalStatus =
  | 'draft'
  | 'needs_review'
  | 'approved'
  | 'rejected';

export type ReviewScope = 'case' | 'person' | 'media' | 'derived_asset';

export type ReviewType =
  | 'factual'
  | 'safety'
  | 'likeness'
  | 'narrative'
  | 'technical';

export type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'revise';
export type DownloadStatus = 'not_downloaded' | 'downloaded' | 'failed';
export type TranscriptSource = 'source_text' | 'asr' | 'manual' | 'none';
export type ClipRole =
  | 'criminal_candidate'
  | 'suspect_candidate'
  | 'witness_candidate'
  | 'narrator_candidate'
  | 'unknown';
export type VoiceCloneEligibility = 'eligible' | 'fallback_only' | 'reject';
export type VoiceMode = 'real_clone' | 'profile_fallback';
export type CharacterRole = 'criminal' | 'suspect' | 'witness' | 'caller_911' | 'narrator';

/** Heuristic downloader / harvest fitness (pipeline-only UX; not authoritative). */
export type ExtractionFitnessTier = 'strong' | 'ok' | 'weak' | 'avoid';

export interface MediaCandidate {
  mediaId: string;
  caseId: string;
  personId?: string;
  mediaKind: MediaKind;
  originType: OriginType;
  url: string;
  localStoragePath?: string;
  localRawMediaPath?: string;
  localAudioExtractPath?: string;
  downloadStatus: DownloadStatus;
  durationSec?: number;
  width?: number;
  height?: number;
  bitrateKbps?: number;
  speakerLabel?: string;
  speakerConfidence?: number;
  speechDurationSec?: number;
  overlapRatio?: number;
  transcriptAvailable: boolean;
  transcriptTextPath?: string;
  transcriptSource: TranscriptSource;
  clipRole: ClipRole;
  voiceCloneEligibility: VoiceCloneEligibility;
  containsTargetPerson: boolean;
  faceVisibilityScore: number;
  voiceIsolatedScore: number;
  backgroundNoiseScore: number;
  usableForCloneScore: number;
  rightsNotes?: string;
  sourceIds: string[];
  extractedAt: string;
  extractionFitnessScore?: number;
  extractionFitnessTier?: ExtractionFitnessTier;
  extractionFitnessNotes?: string;
}

export interface DerivedAsset {
  assetId: string;
  caseId: string;
  personId?: string;
  evidenceId?: string;
  assetType: AssetType;
  toolProvider: ToolProvider;
  voiceMode?: VoiceMode;
  providerVoiceId?: string;
  providerVoiceName?: string;
  renderText?: string;
  characterRole?: CharacterRole;
  inputMediaIds: string[];
  promptOrRecipe: string;
  modelName: string;
  outputUri: string;
  previewUri?: string;
  generationDate: string;
  qualityScore: number;
  similarityScore?: number;
  approvalStatus: ApprovalStatus;
  reviewNotes?: string;
}

export interface ReviewRecord {
  reviewId: string;
  caseId: string;
  personId?: string;
  mediaId?: string;
  assetId?: string;
  reviewScope: ReviewScope;
  reviewType: ReviewType;
  status: ReviewStatus;
  reviewer: string;
  decisionReason: string;
  decidedAt: string;
}

export interface VoiceRosterEntry {
  rosterId: string;
  caseId: string;
  personId?: string;
  characterRole: CharacterRole;
  displayName: string;
  priority: number;
  selectedMediaId?: string;
  voiceMode: VoiceMode;
  decisionReason: string;
  strictGatePassed: boolean;
  fallbackPrompt: string;
  introText: string;
  defaultAnswerText: string;
  qcSampleText: string;
  render911Text?: string;
  renderRevealText?: string;
  reviewerApprovalRequired: boolean;
  approvedForRealClone: boolean;
}
