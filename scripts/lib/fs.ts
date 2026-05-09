import fs from 'node:fs';
import path from 'node:path';

export function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function readJsonFile<T>(filePath: string, fallback: T): T {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

export function writeJsonFile(filePath: string, value: unknown): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export function appendJsonl(filePath: string, value: unknown): void {
  ensureDir(path.dirname(filePath));
  fs.appendFileSync(filePath, `${JSON.stringify(value)}\n`, 'utf8');
}

export function writeJsonl(filePath: string, values: unknown[]): void {
  ensureDir(path.dirname(filePath));
  const contents = values.map((value) => JSON.stringify(value)).join('\n');
  fs.writeFileSync(filePath, contents ? `${contents}\n` : '', 'utf8');
}

export function writeTextFile(filePath: string, value: string): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, value, 'utf8');
}

export function writeBinaryFile(filePath: string, value: Uint8Array): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, value);
}

export function copyFile(fromPath: string, toPath: string): void {
  ensureDir(path.dirname(toPath));
  fs.copyFileSync(fromPath, toPath);
}
