import fs from 'node:fs/promises';
import path from 'node:path';

import type { SkillMatch, StructureComparison, StructureComparisonEntry, StructureEntry } from '../types/skill.js';

export async function compareStructure(rootDir: string, matches: SkillMatch[]): Promise<StructureComparison> {
  const primary = matches.find((match) => match.primary);

  if (!primary) {
    return {
      skillId: '',
      entries: [],
      isAvailable: false
    };
  }

  const requiredEntries = await compareEntries(rootDir, primary.skill.structure.requiredDirs, true);
  const recommendedEntries = await compareEntries(rootDir, primary.skill.structure.recommendedDirs, false);

  return {
    skillId: primary.skill.id,
    entries: [...requiredEntries, ...recommendedEntries],
    isAvailable: true
  };
}

async function compareEntries(rootDir: string, entries: StructureEntry[], required: boolean): Promise<StructureComparisonEntry[]> {
  return Promise.all(
    entries.map(async (entry) => ({
      path: entry.path,
      purpose: entry.purpose,
      required,
      status: (await pathExists(path.join(rootDir, entry.path))) ? 'present' : 'missing'
    }))
  );
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}
