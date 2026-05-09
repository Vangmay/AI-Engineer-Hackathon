import type { GameBackend } from './contracts';
import { localBackend } from './localBackend';

let active: GameBackend = localBackend;

/** Pass `null` to restore the in-browser local adapter. */
export function setGameBackend(next: GameBackend | null) {
  active = next ?? localBackend;
}

// Backend seam: default is local; `ConvexGameBackendProvider` installs Convex when `VITE_CONVEX_URL` is set.
export const gameBackend: GameBackend = {
  startNewCase: (...args) => active.startNewCase(...args),
  loadCase: (...args) => active.loadCase(...args),
  resumeSession: (...args) => active.resumeSession(...args),
  startInterview: (...args) => active.startInterview(...args),
  endInterview: (...args) => active.endInterview(...args),
  goToAccusation: (...args) => active.goToAccusation(...args),
  appendTranscriptLine: (...args) => active.appendTranscriptLine(...args),
  evaluateAccusation: (...args) => active.evaluateAccusation(...args),
  resetSession: (...args) => active.resetSession(...args),
};
