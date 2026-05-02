import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { compareStructure } from '../../../src/skills/structure-check';
import type { ArchitectureSkill, SkillMatch } from '../../../src/types/skill';

const skill: ArchitectureSkill = {
  schemaVersion: '1.0.0',
  id: 'test-skill',
  name: 'Test Skill',
  version: '1.0.0',
  description: 'Test skill.',
  category: 'stack',
  language: 'javascript',
  frameworks: [],
  detection: {},
  structure: {
    requiredDirs: [{ path: 'src/routes', purpose: 'Routes.' }],
    recommendedDirs: [{ path: 'src/services', purpose: 'Services.' }]
  },
  separation: { rules: [] },
  patterns: {},
  antiPatterns: []
};

describe('compareStructure', () => {
  it('marks required and recommended directories as present or missing', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'architect-structure-'));
    await fs.mkdir(path.join(root, 'src/routes'), { recursive: true });

    const comparison = await compareStructure(root, [{ skill, primary: true } as SkillMatch]);

    expect(comparison?.isAvailable).toBe(true);
    expect(comparison?.entries).toEqual([
      { path: 'src/routes', purpose: 'Routes.', required: true, status: 'present' },
      { path: 'src/services', purpose: 'Services.', required: false, status: 'missing' }
    ]);
  });

  it('returns unavailable comparison when no primary skill exists', async () => {
    const comparison = await compareStructure('/tmp/project', []);

    expect(comparison?.isAvailable).toBe(false);
    expect(comparison?.entries).toEqual([]);
  });
});
