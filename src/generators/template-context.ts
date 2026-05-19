import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { render } from './templateRenderer.js';
import type { ScanResult } from '../types/analysis.js';
import type { RenderedSkillFile, TemplateContext } from '../types/generation.js';
import type { ArchitectureSkill, SkillMatch, StructureEntry } from '../types/skill.js';

const TEMPLATE_NAMES = ['architect-plan', 'architect-refactor', 'architect-catchup'] as const;

type TemplateName = (typeof TEMPLATE_NAMES)[number];

export async function renderBundledTemplates(context: TemplateContext): Promise<RenderedSkillFile[]> {
  const templates = await Promise.all(
    TEMPLATE_NAMES.map(async (name) => ({
      name,
      template: await loadBundledTemplate(name)
    }))
  );

  return templates.map(({ name, template }) => ({
    name,
    content: render(template, context)
  }));
}

export async function loadBundledTemplate(name: TemplateName): Promise<string> {
  return fs.readFile(resolveTemplatePath(name), 'utf8');
}

export function buildTemplateContext(skill: ArchitectureSkill, result: ScanResult, allMatched?: SkillMatch[]): TemplateContext {
  const largestFiles = [...result.files]
    .sort((left, right) => right.loc - left.loc || left.relativePath.localeCompare(right.relativePath))
    .slice(0, 5)
    .map((file) => `- ${file.relativePath} (${file.loc} LOC)`);
  const hubFiles = [...result.dependencyGraph.hotspots]
    .sort((left, right) => right.dependentCount - left.dependentCount || left.relativePath.localeCompare(right.relativePath))
    .slice(0, 5)
    .map((hotspot) => `- ${hotspot.relativePath} (${hotspot.dependentCount} dependents)`);
  const missingDirs = (result.structureComparison?.entries ?? [])
    .filter((entry) => entry.required && entry.status === 'missing')
    .map((entry) => `- ${entry.path}`);

  return {
    skill: {
      id: skill.id,
      name: skill.name,
      structure: {
        required: formatStructureEntries(skill.structure.requiredDirs)
      },
      separation: {
        data_flow: formatDataFlow(skill),
        rules: formatSeparationRules(skill)
      },
      anti_patterns: formatAntiPatterns(skill)
    },
    skills: {
      detected: allMatched && allMatched.length > 0
        ? allMatched.map((m) => m.skill.id).join(' ')
        : skill.id
    },
    analysis: {
      largestFiles: largestFiles.join('\n'),
      hubFiles: hubFiles.join('\n'),
      duplicationPercent: `${result.duplication.duplicationPercentage.toFixed(1)}%`,
      missingDirs: missingDirs.join('\n')
    }
  };
}

export function resolveSkillByReference(reference: string, skills: ArchitectureSkill[]): ArchitectureSkill | undefined {
  const normalized = reference.trim().toLowerCase();

  return skills.find((skill) => skill.id.toLowerCase() === normalized)
    ?? skills.find((skill) => skill.name.toLowerCase() === normalized);
}

export function resolveSkillsByReference(references: string[], skills: ArchitectureSkill[]): {
  resolvedSkills: ArchitectureSkill[];
  missingReferences: string[];
} {
  const resolvedSkills: ArchitectureSkill[] = [];
  const missingReferences: string[] = [];
  const seen = new Set<string>();

  for (const reference of references) {
    const skill = resolveSkillByReference(reference, skills);

    if (!skill) {
      missingReferences.push(reference);
      continue;
    }

    if (!seen.has(skill.id)) {
      resolvedSkills.push(skill);
      seen.add(skill.id);
    }
  }

  return { resolvedSkills, missingReferences };
}

export function formatStructureEntries(entries: StructureEntry[]): string {
  return entries.map((entry) => `- ${entry.path}: ${entry.purpose}`).join('\n');
}

export function formatDataFlow(skill: ArchitectureSkill): string {
  const dataFlow = skill.patterns.dataFlow;

  if (!dataFlow) {
    return '';
  }

  const lines = [dataFlow.direction];

  for (const rule of dataFlow.rules) {
    lines.push(`- ${rule}`);
  }

  return lines.join('\n');
}

export function formatSeparationRules(skill: ArchitectureSkill): string {
  return skill.separation.rules
    .map((rule) => {
      const lines = [
        `- ${rule.concern} -> ${rule.belongsIn}`,
        `  Rule: ${rule.ruleText}`,
        '  Example:',
        indentBlock(rule.example)
      ];

      return lines.join('\n');
    })
    .join('\n\n');
}

export function formatAntiPatterns(skill: ArchitectureSkill): string {
  return skill.antiPatterns
    .map((pattern) => {
      const lines = [
        `- ${pattern.id} [${pattern.severity}]`,
        `  ${pattern.description}`,
        '  Bad example:',
        indentBlock(pattern.badExample),
        '  Good example:',
        indentBlock(pattern.goodExample)
      ];

      return lines.join('\n');
    })
    .join('\n\n');
}

function resolveTemplatePath(name: TemplateName): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), `../../templates/${name}.md`);
}

function indentBlock(value: string): string {
  return value
    .trim()
    .split('\n')
    .map((line) => `    ${line}`)
    .join('\n');
}