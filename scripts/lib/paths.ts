import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const dataDir = path.join(rootDir, 'data');
export const casesDir = path.join(dataDir, 'cases');
export const indexDir = path.join(dataDir, 'index');
