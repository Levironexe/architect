import fs from 'node:fs/promises';
import path from 'node:path';

import type { FileAnalysis } from '../types/analysis.js';
import type { ArchitectureSkill, CompositionPhase, ProjectCharacteristics, SkillMatch } from '../types/skill.js';
import { detectLanguage, detectAllLanguages, type DetectedLanguage } from '../languages/registry.js';

export { detectLanguage, detectAllLanguages, type DetectedLanguage };

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

export async function collectProjectCharacteristicsFromLanguage(rootDir: string, detected: DetectedLanguage): Promise<ProjectCharacteristics> {
  const deps = await detected.config.readDependencies(rootDir);
  const dependencies = new Set(deps);

  let files: string[] = [];
  try {
    files = await collectLanguageFiles(rootDir, detected.config.extensions);
  } catch {
    // extension scan failed, continue with empty files
  }

  return {
    rootDir,
    dependencies,
    files,
    sourceText: ''
  };
}

async function collectLanguageFiles(rootDir: string, extensions: string[]): Promise<string[]> {
  const extSet = new Set(extensions);
  const files: string[] = [];
  const skipDirs = new Set(['node_modules', '.git', 'dist', 'build', '.next', '__pycache__', '.venv', 'venv', 'env', 'bin', 'obj', '.turbo']);

  async function walk(dir: string, depth: number): Promise<void> {
    if (depth > 6) return;
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!skipDirs.has(entry.name)) await walk(fullPath, depth + 1);
      } else {
        const ext = path.extname(entry.name);
        if (extSet.has(ext)) {
          files.push(path.relative(rootDir, fullPath).split(path.sep).join('/'));
        }
      }
    }
  }

  await walk(rootDir, 0);
  return files;
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
  const primary = scored.find((match) => match.skill.category === 'stack' && match.score >= 2)
    ?? scored.find((match) => match.skill.category === 'pattern' && match.score >= 2);

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

  if (skill.category === 'meta' && score === 0 && hasLanguageSignal(characteristics, skill.language)) {
    score = 1;
    reasons.push(`language:${skill.language}`);
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

import { LANGUAGE_REGISTRY } from '../languages/registry.js';

const LANGUAGE_EXTENSION_MAP = new Map<string, RegExp>();
for (const lang of LANGUAGE_REGISTRY) {
  const escaped = lang.extensions.map((e) => e.replace('.', '\\.')).join('|');
  LANGUAGE_EXTENSION_MAP.set(lang.id, new RegExp(`(${escaped})$`));
}

function hasLanguageSignal(characteristics: ProjectCharacteristics, language?: string): boolean {
  if (language) {
    const pattern = LANGUAGE_EXTENSION_MAP.get(language);
    if (pattern) return characteristics.files.some((filePath) => pattern.test(filePath));
  }
  return characteristics.files.some((filePath) => /\.(js|jsx|ts|tsx)$/.test(filePath));
}

export function collectComposedPhases(matchedSkills: SkillMatch[]): CompositionPhase[] {
  const matchedIds = new Set(matchedSkills.map((m) => m.skill.id));
  const phases: CompositionPhase[] = [];

  for (const match of matchedSkills) {
    const rules = match.skill.composition;
    if (!rules) continue;

    for (const rule of rules) {
      if (matchedIds.has(rule.whenCombinedWith)) {
        phases.push(...rule.additionalPhases);
      }
    }
  }

  return phases.sort((a, b) => a.priority - b.priority);
}

function getPackageName(source: string): string {
  return source.startsWith('@') ? source.split('/').slice(0, 2).join('/') : source.split('/')[0] ?? source;
}
