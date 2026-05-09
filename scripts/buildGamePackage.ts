import { loadCaseBundle, saveCaseBundle } from './lib/caseFiles.ts';
import { parseArgs } from './lib/cli.ts';
import { loadLocalEnv, requireEnv } from './lib/env.ts';
import { rootDir } from './lib/paths.ts';
import { buildGameCasePackage } from './lib/pipeline.ts';

async function main() {
  loadLocalEnv(rootDir);
  const args = parseArgs(process.argv.slice(2));
  requireEnv({
    required: ['OPENAI_API_KEY'],
    optional: ['OPENAI_MODEL', 'ELEVENLABS_API_KEY'],
  });
  const caseId = args.caseId;
  if (!caseId) {
    throw new Error('Usage: npm run build-game-package -- --caseId=<caseId>');
  }

  const bundle = loadCaseBundle(caseId);
  if (!bundle.caseRecord.caseId) {
    throw new Error(`Case bundle "${caseId}" does not exist.`);
  }

  const packageRecord = buildGameCasePackage({
    caseRecord: bundle.caseRecord,
    people: bundle.people,
    timeline: bundle.timeline,
    evidence: bundle.evidence,
    voiceRoster: bundle.voiceRoster,
    derivedAssets: bundle.derivedAssets.filter(
      (asset) => asset.approvalStatus === 'approved' || asset.approvalStatus === 'needs_review',
    ),
  });

  saveCaseBundle(caseId, {
    packageRecord,
    caseRecord: {
      ...bundle.caseRecord,
      gameAdaptationStatus: 'adapted',
      updatedAt: new Date().toISOString(),
    },
  });

  console.log(`Built game package for ${caseId}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
