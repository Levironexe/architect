import type { ArchitectureSkill } from '../types/skill.js';
import {
  formatAntiPatterns,
  formatDataFlow,
  formatSeparationRules,
  formatStructureEntries
} from './template-context.js';

export function renderBlueprint(skill: ArchitectureSkill): string {
  const sections = [
    `# ${skill.name} (${skill.id})`,
    '',
    '## Structure',
    '### Required',
    formatStructureEntries(skill.structure.requiredDirs) || '- none',
    '',
    '### Recommended',
    formatStructureEntries(skill.structure.recommendedDirs) || '- none',
    '',
    '## Data Flow',
    formatDataFlow(skill) || '- none',
    '',
    '## Separation Rules',
    formatSeparationRules(skill) || '- none',
    '',
    '## Anti-Patterns',
    formatAntiPatterns(skill) || '- none'
  ];

  return sections.join('\n');
}

export function renderBlueprints(skills: ArchitectureSkill[]): string {
  return skills.map((skill) => renderBlueprint(skill)).join('\n\n---\n\n');
}