import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { load } from 'js-yaml';

import type { ArchitectureSkill, SkillLoadResult, SkillWarning } from '../types/skill.js';
import { validateSkill } from './validator.js';

export interface LoadSkillsOptions {
  builtInDir?: string;
  userDir?: string;
}

export async function loadSkills(options: LoadSkillsOptions = {}): Promise<SkillLoadResult> {
  const builtInDir = options.builtInDir ?? getDefaultBuiltInSkillDir();
  const userDir = options.userDir ?? path.join(os.homedir(), '.architect', 'skills');
  const warnings: SkillWarning[] = [];
  const builtIns = await loadSkillDirectory(builtInDir, warnings);
  const userSkills = await loadSkillDirectory(userDir, warnings);
  const merged = new Map<string, ArchitectureSkill>();

  for (const skill of builtIns) {
    merged.set(skill.id, skill);
  }

  for (const skill of userSkills) {
    merged.set(skill.id, skill);
  }

  return {
    skills: [...merged.values()].sort((left, right) => left.id.localeCompare(right.id)),
    warnings
  };
}

async function loadSkillDirectory(directory: string, warnings: SkillWarning[]): Promise<ArchitectureSkill[]> {
  const files = await findSkillFiles(directory);
  const skills: ArchitectureSkill[] = [];

  for (const file of files) {
    try {
      const contents = await fs.readFile(file, 'utf8');
      const { data } = parseFrontmatter(contents, file);
      const result = validateSkill(data, file);

      if (result.skill) {
        skills.push(result.skill);
      }

      if (result.warning) {
        warnings.push(result.warning);
      }
    } catch (error) {
      warnings.push({
        file,
        message: error instanceof Error ? error.message : 'Unable to read skill file'
      });
    }
  }

  return skills;
}

async function findSkillFiles(directory: string): Promise<string[]> {
  try {
    const categoryEntries = await fs.readdir(directory, { withFileTypes: true });
    const files = await Promise.all(
      categoryEntries.map(async (categoryEntry) => {
        if (!categoryEntry.isDirectory()) return [];

        const categoryPath = path.join(directory, categoryEntry.name);
        const skillEntries = await fs.readdir(categoryPath, { withFileTypes: true }).catch(() => []);

        return Promise.all(
          skillEntries.map(async (skillEntry) => {
            if (!skillEntry.isDirectory()) return [];

            const skillMdPath = path.join(categoryPath, skillEntry.name, 'SKILL.md');
            try {
              await fs.access(skillMdPath);
              return [skillMdPath];
            } catch {
              return [];
            }
          })
        ).then((nested) => nested.flat());
      })
    );

    return files.flat().sort();
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      return [];
    }

    throw error;
  }
}

function parseFrontmatter(source: string, file: string): { data: unknown; body: string } {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) {
    throw new Error(`No YAML frontmatter found in ${file}`);
  }
  return { data: load(match[1]!), body: source.slice(match[0].length) };
}

function getDefaultBuiltInSkillDir(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../skills');
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
