import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { listSkillsWithActiveStatus, renderSkillList } from '../../../src/skills/lister';
import type { ActiveSkillCheck } from '../../../src/skills/lister';

const mockLoadSkills = vi.fn();

const FAKE_SKILLS = [
  { id: 'express-api', name: 'Express API' },
  { id: 'next-app', name: 'Next.js App' }
] as never[];

describe('listSkillsWithActiveStatus', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'architect-lister-'));
    mockLoadSkills.mockResolvedValue({ skills: FAKE_SKILLS });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('marks a skill as active when its SKILL.md exists', async () => {
    const skillDir = path.join(tempDir, '.claude', 'skills', 'express-api');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(path.join(skillDir, 'SKILL.md'), '# skill', 'utf8');

    const result = await listSkillsWithActiveStatus(tempDir, mockLoadSkills);

    const express = result.find((r) => r.skillId === 'express-api');
    expect(express?.isActive).toBe(true);
    expect(express?.installPath).toContain('express-api');
  });

  it('marks a skill as inactive when SKILL.md does not exist', async () => {
    const result = await listSkillsWithActiveStatus(tempDir, mockLoadSkills);

    const express = result.find((r) => r.skillId === 'express-api');
    expect(express?.isActive).toBe(false);
    expect(express?.installPath).toBeUndefined();
  });

  it('returns one entry per loaded skill', async () => {
    const result = await listSkillsWithActiveStatus(tempDir, mockLoadSkills);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.skillId)).toEqual(['express-api', 'next-app']);
  });
});

describe('renderSkillList', () => {
  it('shows [active] label for active skills', () => {
    const checks: ActiveSkillCheck[] = [
      { skillId: 'express-api', skillName: 'Express API', isActive: true, installPath: '/some/path' },
      { skillId: 'next-app', skillName: 'Next.js App', isActive: false, installPath: undefined }
    ];

    const output = renderSkillList(checks);
    expect(output).toContain('[active]');
    expect(output).toContain('express-api');
    expect(output).toContain('next-app');
    expect(output).not.toContain('architect init');
  });

  it('shows hint when no skills are active', () => {
    const checks: ActiveSkillCheck[] = [
      { skillId: 'express-api', skillName: 'Express API', isActive: false, installPath: undefined },
      { skillId: 'next-app', skillName: 'Next.js App', isActive: false, installPath: undefined }
    ];

    const output = renderSkillList(checks);
    expect(output).toContain('architect init .');
    expect(output).not.toContain('[active]');
  });

  it('returns fallback message for empty skill list', () => {
    expect(renderSkillList([])).toContain('No skills available');
  });
});
