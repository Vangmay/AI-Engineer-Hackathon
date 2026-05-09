import fs from 'node:fs';
import path from 'node:path';

type EnvSpec = {
  required?: string[];
  optional?: string[];
};

const ENV_FILES = ['.env.local', '.env'];

function parseEnvFile(content: string): Record<string, string> {
  const vars: Record<string, string> = {};

  for (const line of content.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    vars[key] = value;
  }

  return vars;
}

export function loadLocalEnv(rootDir: string): void {
  for (const relativeFile of ENV_FILES) {
    const envPath = path.join(rootDir, relativeFile);
    if (!fs.existsSync(envPath)) continue;
    const content = fs.readFileSync(envPath, 'utf8');
    const parsed = parseEnvFile(content);
    for (const [key, value] of Object.entries(parsed)) {
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  }
}

export function requireEnv(spec: EnvSpec): Record<string, string | undefined> {
  const missing = (spec.required ?? []).filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  const names = [...(spec.required ?? []), ...(spec.optional ?? [])];
  return Object.fromEntries(names.map((name) => [name, process.env[name]]));
}
