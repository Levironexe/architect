import fs from 'node:fs/promises';
import path from 'node:path';

import type { FileAnalysis } from '../types/analysis.js';
import type { ArchitectureSkill, ProjectCharacteristics, SkillMatch } from '../types/skill.js';

export async function collectProjectCharacteristics(rootDir: string, filePaths: string[], analyses: FileAnalysis[]): Promise<ProjectCharacteristics> {
  const dependencies = new Set(await readPackageDependencies(rootDir));

  for (const analysis of analyses) {
    for (const item of analysis.imports) {
      if (!item.isRelative && !item.isBuiltin) {
        dependencies.add(getPackageName(item.source));
      }
    }
  }

  return {
    rootDir,
    dependencies,
    files: filePaths.map((filePath) => path.relative(rootDir, filePath).split(path.sep).join('/')),
    sourceText: await readSourceText(filePaths)
  };
}

export function detectSkills(characteristics: ProjectCharacteristics, skills: ArchitectureSkill[]): SkillMatch[] {
  const scored = skills
    .map((skill) => scoreSkill(skill, characteristics))
    .filter((match) => match.score > 0 || (match.skill.category === 'meta' && hasLanguageSignal(characteristics)))
    .sort((left, right) => {
      if (left.skill.category !== right.skill.category) {
        return left.skill.category === 'meta' ? 1 : -1;
      }

      return right.score - left.score || left.skill.id.localeCompare(right.skill.id);
    });
  const primary = scored.find((match) => match.skill.category === 'stack' && match.score >= 2);

  return scored.map((match) => ({
    ...match,
    primary: primary?.skill.id === match.skill.id
  }));
}

function scoreSkill(skill: ArchitectureSkill, characteristics: ProjectCharacteristics): SkillMatch {
  let score = 0;
  const reasons: string[] = [];
  const dependencies = skill.detection.dependencies;

  if (dependencies?.none?.some((dependency) => characteristics.dependencies.has(dependency))) {
    return { skill, confidence: 'low', score: 0, reasons: ['excluded by dependency rule'], primary: false };
  }

  if (dependencies?.any?.some((dependency) => characteristics.dependencies.has(dependency))) {
    score += 2;
    reasons.push('dependency:any');
  }

  for (const dependency of dependencies?.all ?? []) {
    if (!characteristics.dependencies.has(dependency)) {
      return { skill, confidence: 'low', score: 0, reasons: [`missing dependency:${dependency}`], primary: false };
    }

    score += 2;
    reasons.push(`dependency:${dependency}`);
  }

  for (const filePattern of skill.detection.files ?? []) {
    if (characteristics.files.some((filePath) => filePath === filePattern || filePath.startsWith(`${filePattern}/`))) {
      score += 2;
      reasons.push(`file:${filePattern}`);
    }
  }

  for (const indicator of skill.detection.sourceIndicators ?? []) {
    if (characteristics.sourceText.includes(indicator)) {
      score += 1;
      reasons.push(`source:${indicator}`);
    }
  }

  if (skill.category === 'meta' && score === 0 && hasLanguageSignal(characteristics)) {
    score = 1;
    reasons.push('language:javascript');
  }

  return {
    skill,
    confidence: score >= 2 ? 'high' : score === 1 ? 'medium' : 'low',
    score,
    reasons,
    primary: false
  };
}

async function readPackageDependencies(rootDir: string): Promise<string[]> {
  try {
    const contents = await fs.readFile(path.join(rootDir, 'package.json'), 'utf8');
    const parsed = JSON.parse(contents) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    return [...Object.keys(parsed.dependencies ?? {}), ...Object.keys(parsed.devDependencies ?? {})].map(getPackageName);
  } catch {
    return [];
  }
}

async function readSourceText(filePaths: string[]): Promise<string> {
  const contents = await Promise.all(
    filePaths.map(async (filePath) => {
      try {
        return await fs.readFile(filePath, 'utf8');
      } catch {
        return '';
      }
    })
  );

  return contents.join('\n');
}

function hasLanguageSignal(characteristics: ProjectCharacteristics): boolean {
  return characteristics.files.some((filePath) => /\.(js|jsx|ts|tsx)$/.test(filePath));
}

function getPackageName(source: string): string {
  return source.startsWith('@') ? source.split('/').slice(0, 2).join('/') : source.split('/')[0] ?? source;
}
