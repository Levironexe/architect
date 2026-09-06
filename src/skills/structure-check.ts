import fs from 'node:fs/promises';
import path from 'node:path';

import type { SkillMatch, StructureComparison, StructureComparisonEntry, StructureEntry } from '../types/skill.js';

export async function compareStructure(
  rootDir: string,
  matches: SkillMatch[],
  relativePaths: string[] = []
): Promise<StructureComparison> {
  const primary = matches.find((match) => match.primary);

  if (!primary) {
    return { skillId: '', entries: [], isAvailable: false };
  }

  const sourceRoots = deriveSourceRoots(primary.skill.structure.requiredDirs, relativePaths);
  const requiredEntries = await compareEntries(rootDir, sourceRoots, primary.skill.structure.requiredDirs, true);
  const recommendedEntries = await compareEntries(rootDir, sourceRoots, primary.skill.structure.recommendedDirs, false);

  return {
    skillId: primary.skill.id,
    entries: [...requiredEntries, ...recommendedEntries],
    isAvailable: true
  };
}

/**
 * Where the stack's directories actually live. A Next.js app can sit at the
 * repo root, under src/, or inside a workspace such as apps/web/src/ — checking
 * only the root reports every required directory as missing in a monorepo.
 *
 * Roots are derived from the files we discovered: for each required directory,
 * any path containing that segment contributes its prefix as a candidate root.
 */
function deriveSourceRoots(requiredDirs: StructureEntry[], relativePaths: string[]): string[] {
  const roots = new Set<string>(['', 'src']);

  for (const entry of requiredDirs) {
    const segment = entry.path.split('/')[0];
    if (!segment) continue;

    for (const relativePath of relativePaths) {
      const index = relativePath.split('/').indexOf(segment);
      if (index < 0) continue;
      roots.add(relativePath.split('/').slice(0, index).join('/'));
    }
  }

  return [...roots];
}

async function compareEntries(
  rootDir: string,
  sourceRoots: string[],
  entries: StructureEntry[],
  required: boolean
): Promise<StructureComparisonEntry[]> {
  return Promise.all(
    entries.map(async (entry) => ({
      path: entry.path,
      purpose: entry.purpose,
      required,
      status: (await existsUnderAnyRoot(rootDir, sourceRoots, entry.path)) ? 'present' : 'missing'
    }))
  );
}

async function existsUnderAnyRoot(rootDir: string, sourceRoots: string[], entryPath: string): Promise<boolean> {
  for (const sourceRoot of sourceRoots) {
    if (await pathExists(path.join(rootDir, sourceRoot, entryPath))) return true;
  }
  return false;
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}
