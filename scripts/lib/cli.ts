export function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};

  for (const part of argv) {
    if (!part.startsWith('--')) continue;
    const [key, ...valueParts] = part.slice(2).split('=');
    args[key] = valueParts.length > 0 ? valueParts.join('=') : 'true';
  }

  return args;
}
