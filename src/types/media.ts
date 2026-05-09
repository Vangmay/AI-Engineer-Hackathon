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
  | 'portrait'
  | 'face_model'
  | 'animated_avatar'
  | 'case_image'
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

export interface MediaCandidate {
  mediaId: string;
  caseId: string;
  personId?: string;
  mediaKind: MediaKind;
  originType: OriginType;
  url: string;
  localStoragePath?: string;
  durationSec?: number;
  width?: number;
  height?: number;
  bitrateKbps?: number;
  transcriptAvailable: boolean;
  transcriptTextPath?: string;
  containsTargetPerson: boolean;
  faceVisibilityScore: number;
  voiceIsolatedScore: number;
  backgroundNoiseScore: number;
  usableForCloneScore: number;
  rightsNotes?: string;
  sourceIds: string[];
  extractedAt: string;
}

export interface DerivedAsset {
  assetId: string;
  caseId: string;
  personId?: string;
  assetType: AssetType;
  toolProvider: ToolProvider;
  inputMediaIds: string[];
  promptOrRecipe: string;
  modelName: string;
  outputUri: string;
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
