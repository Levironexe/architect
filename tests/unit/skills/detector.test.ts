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
  it('detects Next.js App Router as the primary stack for a messy Next.js project', async () => {
    const matches = await detectFixture('messy-nextjs');

    expect(matches[0]?.skill.id).toBe('nextjs-app-router');
    expect(matches[0]?.primary).toBe(true);
    expect(matches[0]?.confidence).toBe('high');
  });

  it('detects Next.js App Router for a clean Next.js project', async () => {
    const matches = await detectFixture('clean-nextjs');

    expect(matches[0]?.skill.id).toBe('nextjs-app-router');
    expect(matches[0]?.primary).toBe(true);
  });

  it('returns no confident stack match for a plain utility project', async () => {
    const matches = await detectFixture('clean-project');

    expect(matches.some((match) => match.primary)).toBe(false);
  });
});
