import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { loadSkills } from './loader.js';

export interface ActiveSkillCheck {
  skillId: string;
  skillName: string;
  isActive: boolean;
  installPath: string | undefined;
}

export async function listSkillsWithActiveStatus(
  targetDirectory: string,
  skillLoader: typeof loadSkills = loadSkills
): Promise<ActiveSkillCheck[]> {
  const { skills } = await skillLoader();

  return skills.map((skill) => {
    const installPath = join(targetDirectory, '.claude', 'skills', skill.id, 'SKILL.md');
    const isActive = existsSync(installPath);

    return {
      skillId: skill.id,
      skillName: skill.name,
      isActive,
      installPath: isActive ? installPath : undefined
    };
  });
}

export function renderSkillList(checks: ActiveSkillCheck[]): string {
  if (checks.length === 0) {
    return 'No skills available.\n';
  }

  const maxIdLen = Math.max(...checks.map((c) => c.skillId.length));
  const lines = ['Available skills:', ''];

  for (const check of checks) {
    const id = check.skillId.padEnd(maxIdLen);
    const status = check.isActive ? '[active]   ' : '           ';
    lines.push(`  ${id}   ${status}${check.skillName}`);
  }

  const hasActive = checks.some((c) => c.isActive);
  if (!hasActive) {
    lines.push('');
    lines.push("No skills are active in this directory. Run `architect init .` to install.");
  }

  return lines.join('\n') + '\n';
}
