import type { GameCasePackage } from '@/types/gamePackage';
import packagedCase from '../../data/cases/case_colonel_russell_williams_2010/package.json';

export function getCurrentCasePackage(): GameCasePackage {
  const record = packagedCase as unknown as GameCasePackage | undefined;
  if (!record?.runtimeCase) {
    throw new Error(
      'Missing data/cases/case_colonel_russell_williams_2010/package.json runtimeCase.',
    );
  }
  return record;
}
