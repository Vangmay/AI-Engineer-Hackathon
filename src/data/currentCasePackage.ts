import type { GameCasePackage } from '@/types/gamePackage';
import packagedCase from '../../data/cases/case_raymond_teo_2026/package.json';

export function getCurrentCasePackage(): GameCasePackage {
  const record = packagedCase as GameCasePackage | undefined;
  if (!record?.runtimeCase) {
    throw new Error(
      'Missing data/cases/case_raymond_teo_2026/package.json runtimeCase.',
    );
  }
  return record;
}
