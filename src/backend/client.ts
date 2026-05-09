import type { GameBackend } from './contracts';
import { localBackend } from './localBackend';

// Backend seam for the app. The local adapter implements the same contract the
// Convex server actions will expose, so frontend wiring can progress before
// cloud deployment and provider keys are ready.
export const gameBackend: GameBackend = localBackend;
