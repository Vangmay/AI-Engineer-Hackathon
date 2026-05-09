import { loadCaseBundle, saveCaseBundle } from './lib/caseFiles.ts';
import { parseArgs } from './lib/cli.ts';
import { loadLocalEnv } from './lib/env.ts';
import { rootDir } from './lib/paths.ts';
import { buildVoiceRoster } from './lib/pipeline.ts';

async function main() {
  loadLocalEnv(rootDir);
  const args = parseArgs(process.argv.slice(2));
  const caseId = args.caseId;
  if (!caseId) {
    throw new Error('Usage: npm run build-voice-roster -- --caseId=<caseId>');
  }

  const bundle = loadCaseBundle(caseId);
  const voiceRoster = buildVoiceRoster({
    caseRecord: bundle.caseRecord,
    people: bundle.people,
    media: bundle.media,
    reviews: bundle.reviews,
  });

  saveCaseBundle(caseId, { voiceRoster });
  console.log(`Built voice roster for ${caseId}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
