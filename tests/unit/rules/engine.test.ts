import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { analyzeFile } from '../../../src/analyzers/ast-parser';
import { discoverFiles } from '../../../src/analyzers/file-walker';
import { createRuleContext, runRules } from '../../../src/rules/engine';
import { loadSkills } from '../../../src/skills/loader';
import type { ArchitectureSkill } from '../../../src/types/skill';

async function checkFixture(fixture: string) {
  const rootDir = path.resolve('tests/fixtures', fixture);
  const filePaths = await discoverFiles(rootDir);
  const files = await Promise.all(filePaths.map((filePath) => analyzeFile(filePath, rootDir)));
  const { skills } = await loadSkills();
  const skill = skills.find((entry) => entry.id === 'nextjs-app-router') as ArchitectureSkill;

  return runRules(skill, createRuleContext(files));
}

describe('rule engine', () => {
  describe('direct_db_in_page', () => {
    it('flags a database client imported inside a page component', async () => {
      const violations = await checkFixture('messy-nextjs');
      const found = violations.filter((violation) => violation.rule === 'direct_db_in_page');

      expect(found).toHaveLength(1);
      expect(found[0]?.file).toBe('src/app/page.tsx');
      expect(found[0]?.severity).toBe('critical');
      expect(found[0]?.line).toBe(1);
      expect(found[0]?.fix).toContain('lib/');
    });

    it('does not flag a page that calls into lib/', async () => {
      const violations = await checkFixture('clean-nextjs');

      expect(violations.filter((violation) => violation.rule === 'direct_db_in_page')).toEqual([]);
    });
  });

  describe('direct_db_in_route', () => {
    it('flags a database client imported inside a route handler', async () => {
      const violations = await checkFixture('messy-nextjs');
      const found = violations.filter((violation) => violation.rule === 'direct_db_in_route');

      expect(found).toHaveLength(1);
      expect(found[0]?.file).toBe('src/app/api/projects/route.ts');
      expect(found[0]?.severity).toBe('critical');
    });

    it('does not flag a project with no route handlers importing a client', async () => {
      const violations = await checkFixture('clean-nextjs');

      expect(violations.filter((violation) => violation.rule === 'direct_db_in_route')).toEqual([]);
    });
  });

  it('reports nothing at all for a correctly structured project', async () => {
    expect(await checkFixture('clean-nextjs')).toEqual([]);
  });

  it('ignores anti-patterns that declare no detect block', async () => {
    const { skills } = await loadSkills();
    const skill = skills.find((entry) => entry.id === 'nextjs-app-router') as ArchitectureSkill;
    const withoutDetect = skill.antiPatterns.filter((antiPattern) => !antiPattern.detect);

    expect(withoutDetect.length).toBeGreaterThan(0);

    const violations = await checkFixture('messy-nextjs');
    const guidanceOnlyIds = new Set(withoutDetect.map((antiPattern) => antiPattern.id));

    expect(violations.some((violation) => guidanceOnlyIds.has(violation.rule))).toBe(false);
  });
});
