import type { DerivedAsset } from '../src/types/media.ts';
import { loadCaseBundle, saveCaseBundle } from './lib/caseFiles.ts';
import { parseArgs } from './lib/cli.ts';
import { loadLocalEnv, requireEnv } from './lib/env.ts';
import {
  createFalImageDraft,
  createFalImageTo3DDraft,
  createFalTextTo3DDraft,
} from './lib/fal.ts';
import { createId } from './lib/ids.ts';
import { rootDir } from './lib/paths.ts';

function upsertAssets(existing: DerivedAsset[], additions: DerivedAsset[]): DerivedAsset[] {
  return [
    ...existing.filter(
      (asset) => !additions.some((next) => next.assetId === asset.assetId),
    ),
    ...additions,
  ];
}

const UNSAFE_PATTERNS: Array<[RegExp, string]> = [
  [/\bbenzodiazepine\w*\b/gi, 'white crystalline powder'],
  [/\bfentanyl\b/gi, 'white powder'],
  [/\bcocaine\b/gi, 'white powder'],
  [/\bheroin\b/gi, 'brown substance'],
  [/\bamphetamine\w*\b/gi, 'powder substance'],
  [/\bnarcotic\w*\b/gi, 'substance'],
  [/\bnot prescribed\b/gi, 'unidentified'],
  [/\bprescribed to the victim\b/gi, 'logged in evidence'],
  [/\bstrangulat\w*\b/gi, 'trauma'],
  [/\bstabbed?\b/gi, 'marked'],
  [/\bblood\b/gi, 'dark fluid'],
  [/\bkilled?\b/gi, 'present'],
  [/\bmurdered?\b/gi, 'present'],
  [/\bvictim\b/gi, 'subject'],
  [/\bTOD\b/g, 'logged timestamp'],
  [/\btime of death\b/gi, 'logged timestamp'],
  [/\bdeceased\b/gi, 'subject'],
  [/\bmatches no one\b/gi, 'unidentified'],
  [/\bcontradict\w*\b/gi, 'inconsistent with'],
  [/\bsupport\w*\b/gi, 'consistent with'],
  [/\bthree minutes after estimated\b/gi, 'shortly after'],
  [/\bafter estimated\b/gi, 'at'],
  [/\bmurder\w*\b/gi, 'incident'],
  [/\bcrime\b/gi, 'investigation'],
  [/\bsuspect\b/gi, 'person'],
  [/\bhomicide\b/gi, 'incident'],
];

function sanitiseForImage(text: string): string {
  let out = text;
  for (const [pattern, replacement] of UNSAFE_PATTERNS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

function extractVisualSubject(description: string, evidenceType: string): string {
  const safe = sanitiseForImage(description);
  const lower = description.toLowerCase();

  if (lower.includes('tumbler') || lower.includes('glass') && lower.includes('nightstand')) {
    return 'glass tumbler with white crystalline residue on the interior surface, placed on a dark wooden surface';
  }
  if (lower.includes('access log') || lower.includes('door') && lower.includes('opened')) {
    return 'digital security keypad panel with an illuminated LED timestamp display mounted on a wall';
  }
  if (lower.includes('wine glass')) {
    return 'crystal wine glass with a red lipstick imprint on the rim, resting inside a stainless steel sink';
  }

  return safe;
}

function runtimeEvidencePrompt(input: {
  caseTitle: string;
  victimName: string;
  evidenceLabel: string;
  evidenceDescription: string;
  evidenceType?: string;
}): string {
  const subject = extractVisualSubject(input.evidenceDescription, input.evidenceType ?? '');
  return [
    `Close-up forensic evidence photograph: ${subject}.`,
    `Evidence collection tag visible, white measuring ruler alongside, Singapore Police Force CID, overhead studio lighting, photorealistic, no gore, no text.`,
  ].join(' ');
}

async function main() {
  loadLocalEnv(rootDir);
  const args = parseArgs(process.argv.slice(2));
  const env = requireEnv({
    required: ['FAL_API_KEY'],
    optional: [
      'FAL_MODEL',
      'FAL_IMAGE_MODEL',
      'FAL_SCENE_MODEL',
      'FAL_IMAGE_TO_3D_MODEL',
      'FAL_TEXT_TO_3D_MODEL',
    ],
  });
  const caseId = args.caseId;
  if (!caseId) {
    throw new Error('Usage: npm run generate-evidence-drafts -- --caseId=<caseId>');
  }

  const skip3d = args.skip3d === 'true';
  const only3d = args.only3d === 'true';
  const bundle = loadCaseBundle(caseId);
  const runtimeCase = bundle.packageRecord?.runtimeCase;
  if (!runtimeCase) {
    throw new Error(
      `Case "${caseId}" has no package.json runtimeCase. Run npm run build-game-package first.`,
    );
  }

  const additions: DerivedAsset[] = [];
  const now = new Date().toISOString();

  if (!only3d) {
    const scenePrompt = [
      `Luxury Singapore penthouse apartment interior, forensic investigation, evidence markers visible on surfaces,`,
      `Singapore Police Force CID documentation photograph, realistic apartment lighting, cinematic composition, no gore, no readable text.`,
    ].join(' ');
    const scene = await createFalImageDraft({
      apiKey: env.FAL_API_KEY!,
      prompt: scenePrompt,
      model: env.FAL_SCENE_MODEL ?? env.FAL_IMAGE_MODEL ?? env.FAL_MODEL,
      aspectRatio: '4:3',
    });
    additions.push({
      assetId: createId('asset', `${caseId}:scene-image`),
      caseId,
      assetType: 'case_image',
      toolProvider: 'fal',
      inputMediaIds: [],
      promptOrRecipe: scenePrompt,
      modelName: scene.modelName,
      outputUri: scene.outputUri,
      generationDate: now,
      qualityScore: 82,
      approvalStatus: 'needs_review',
    });
  }

  for (const [index, evidence] of bundle.evidence.entries()) {
    let renderUri = bundle.derivedAssets.find(
      (asset) =>
        asset.evidenceId === evidence.evidenceId &&
        asset.assetType === 'evidence_render' &&
        asset.outputUri,
    )?.outputUri;
    const prompt = runtimeEvidencePrompt({
      caseTitle: runtimeCase.title,
      victimName: runtimeCase.victim.name,
      evidenceLabel: evidence.label,
      evidenceDescription: evidence.description,
      evidenceType: evidence.evidenceType,
    });

    if (!only3d) {
      const render = await createFalImageDraft({
        apiKey: env.FAL_API_KEY!,
        prompt,
        model: env.FAL_IMAGE_MODEL ?? env.FAL_MODEL,
        aspectRatio: '4:3',
      });
      renderUri = render.outputUri;
      additions.push({
        assetId: createId('asset', `${caseId}:${evidence.evidenceId}:render`),
        caseId,
        evidenceId: evidence.evidenceId,
        assetType: 'evidence_render',
        toolProvider: 'fal',
        inputMediaIds: [],
        promptOrRecipe: prompt,
        modelName: render.modelName,
        outputUri: render.outputUri,
        generationDate: now,
        qualityScore: evidence.confidenceScore,
        approvalStatus: 'needs_review',
        reviewNotes: `Evidence render index ${index}.`,
      });
    }

    if (skip3d) continue;

    const model = renderUri
      ? await createFalImageTo3DDraft({
          apiKey: env.FAL_API_KEY!,
          imageUrl: renderUri,
          model: env.FAL_IMAGE_TO_3D_MODEL,
        })
      : await createFalTextTo3DDraft({
          apiKey: env.FAL_API_KEY!,
          prompt,
          model: env.FAL_TEXT_TO_3D_MODEL,
        });

    additions.push({
      assetId: createId('asset', `${caseId}:${evidence.evidenceId}:model`),
      caseId,
      evidenceId: evidence.evidenceId,
      assetType: 'evidence_model',
      toolProvider: 'fal',
      inputMediaIds: [],
      promptOrRecipe: renderUri
        ? `2D-to-3D reconstruction from generated evidence render: ${renderUri}`
        : prompt,
      modelName: model.modelName,
      outputUri: model.outputUri,
      previewUri: model.previewUri,
      generationDate: now,
      qualityScore: Math.max(60, evidence.confidenceScore - 8),
      approvalStatus: 'needs_review',
      reviewNotes: renderUri
        ? 'Generated with image-to-3D from the fal evidence still.'
        : 'Generated with text-to-3D because no evidence still was available.',
    });
  }

  saveCaseBundle(caseId, {
    derivedAssets: upsertAssets(bundle.derivedAssets, additions),
    caseRecord: {
      ...bundle.caseRecord,
      assetGenerationStatus: additions.length > 0 ? 'generated' : bundle.caseRecord.assetGenerationStatus,
      updatedAt: new Date().toISOString(),
    },
  });

  console.log(`Generated ${additions.length} evidence asset records for ${caseId}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
