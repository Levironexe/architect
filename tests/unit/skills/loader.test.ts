import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { loadSkills } from '../../../src/skills/loader';

const validSkill = `schema_version: "1.0.0"
id: shared-skill
name: "Shared Skill"
version: "1.0.0"
description: "Valid skill."
category: stack
language: javascript
frameworks: [shared]
detection:
  dependencies:
    any: [shared]
structure:
  required_dirs:
    - path: src/shared
      purpose: "Shared area."
  recommended_dirs: []
separation:
  rules:
    - concern: shared
      belongs_in: src/shared
patterns: {}
anti_patterns: []
`;

describe('loadSkills', () => {
  it('loads valid skills and reports invalid skill warnings', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'architect-skills-'));
    const builtInDir = path.join(root, 'built-in');
    await fs.mkdir(builtInDir, { recursive: true });
    await fs.writeFile(path.join(builtInDir, 'valid.skill.yaml'), validSkill);
    await fs.writeFile(path.join(builtInDir, 'invalid.skill.yaml'), 'id: missing-schema\n');

    const result = await loadSkills({ builtInDir, userDir: path.join(root, 'missing-user-dir') });

    expect(result.skills.map((skill) => skill.id)).toEqual(['shared-skill']);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]?.message).toContain('schema_version');
  });

  it('lets valid user-installed skills override built-ins with the same id', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'architect-skills-'));
    const builtInDir = path.join(root, 'built-in');
    const userDir = path.join(root, 'user');
    await fs.mkdir(builtInDir, { recursive: true });
    await fs.mkdir(userDir, { recursive: true });
    await fs.writeFile(path.join(builtInDir, 'shared.skill.yaml'), validSkill);
    await fs.writeFile(path.join(userDir, 'shared.skill.yaml'), validSkill.replace('Shared Skill', 'User Shared Skill'));

    const result = await loadSkills({ builtInDir, userDir });

    expect(result.skills).toHaveLength(1);
    expect(result.skills[0]?.name).toBe('User Shared Skill');
    expect(result.warnings).toEqual([]);
  });
});
