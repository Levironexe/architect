import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { analyzeFile } from '../../../src/analyzers/ast-parser';
import { discoverFiles } from '../../../src/analyzers/file-walker';
import { collectProjectCharacteristics, detectSkills } from '../../../src/skills/detector';
import { loadSkills } from '../../../src/skills/loader';

async function detectFixture(fixture: string) {
  const rootDir = path.resolve('tests/fixtures', fixture);
  const filePaths = await discoverFiles(rootDir);
  const files = await Promise.all(filePaths.map((filePath) => analyzeFile(filePath, rootDir)));
  const skills = await loadSkills({ userDir: path.join(rootDir, '.architect', 'skills') });
  const characteristics = await collectProjectCharacteristics(rootDir, filePaths, files);

  return detectSkills(characteristics, skills.skills);
}

describe('detectSkills', () => {
  it('detects Express API as primary and General JS as secondary for the messy Express fixture', async () => {
    const matches = await detectFixture('messy-express');

    expect(matches[0]?.skill.id).toBe('express-api');
    expect(matches[0]?.primary).toBe(true);
    expect(matches.map((match) => match.skill.id)).toContain('general-js');
  });

  it('detects React SPA as primary for the React fixture', async () => {
    const matches = await detectFixture('decent-react');

    expect(matches[0]?.skill.id).toBe('react-spa');
    expect(matches[0]?.confidence).toBe('high');
  });

  it('returns no confident stack match for a clean utility-only project', async () => {
    const matches = await detectFixture('clean-project');

    expect(matches.some((match) => match.primary)).toBe(false);
    expect(matches.map((match) => match.skill.id)).toContain('general-js');
  });
});
