import path from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import { analyzeFile } from '../../../src/analyzers/ast-parser';
import { discoverFiles } from '../../../src/analyzers/file-walker';
import { createRuleContext, runRules } from '../../../src/rules/engine';
import { loadSkills } from '../../../src/skills/loader';
import type { RuleViolation } from '../../../src/types/rule';
import type { ArchitectureSkill } from '../../../src/types/skill';

async function checkFixture(fixture: string): Promise<RuleViolation[]> {
  const rootDir = path.resolve('tests/fixtures', fixture);
  const filePaths = await discoverFiles(rootDir);
  const files = await Promise.all(filePaths.map((filePath) => analyzeFile(filePath, rootDir)));
  const { skills } = await loadSkills();
  const skill = skills.find((entry) => entry.id === 'nextjs-app-router') as ArchitectureSkill;

  return runRules(skill, createRuleContext(files));
}

let messy: RuleViolation[];
let clean: RuleViolation[];

beforeAll(async () => {
  messy = await checkFixture('messy-nextjs');
  clean = await checkFixture('clean-nextjs');
});

function violationsFor(list: RuleViolation[], rule: string): RuleViolation[] {
  return list.filter((violation) => violation.rule === rule);
}

/**
 * Every rule is asserted twice: it fires on a known violation, and it stays
 * silent on the clean project. A rule with no false-positive test is not done.
 */
const RULES: Array<{ id: string; severity: string; file: string }> = [
  { id: 'direct_db_in_page', severity: 'critical', file: 'src/app/page.tsx' },
  { id: 'direct_db_in_route', severity: 'critical', file: 'src/app/api/projects/route.ts' },
  { id: 'leaked_server_secret', severity: 'critical', file: 'src/components/SecretBanner.tsx' },
  { id: 'illegal_import', severity: 'critical', file: 'src/components/TaskCard.tsx' },
  { id: 'use_client_everywhere', severity: 'warning', file: 'src/app/dashboard/layout.tsx' },
  { id: 'client_data_fetching_by_default', severity: 'warning', file: 'src/app/users/page.tsx' },
  { id: 'server_action_throws', severity: 'warning', file: 'src/actions/task-actions.ts' },
  { id: 'alert_for_errors', severity: 'warning', file: 'src/components/TaskCard.tsx' },
  { id: 'oversized_extraction', severity: 'warning', file: 'src/app/reports/page.tsx' },
  { id: 'scattered_process_env', severity: 'warning', file: 'src/lib/mailer.ts' }
];

describe('rule engine', () => {
  for (const rule of RULES) {
    describe(rule.id, () => {
      it(`flags ${rule.file}`, () => {
        const found = violationsFor(messy, rule.id);

        expect(found.length).toBeGreaterThan(0);
        expect(found.map((violation) => violation.file)).toContain(rule.file);
        expect(found[0]?.severity).toBe(rule.severity);
        expect(found[0]?.message.length).toBeGreaterThan(0);
        expect(found[0]?.fix.length).toBeGreaterThan(0);
        expect(found[0]?.line).toBeGreaterThan(0);
      });

      it('does not fire on the clean project', () => {
        expect(violationsFor(clean, rule.id)).toEqual([]);
      });
    });
  }

  it('reports nothing at all for a correctly structured project', () => {
    expect(clean).toEqual([]);
  });

  it('finds every seeded violation in the messy project', () => {
    expect(messy).toHaveLength(11);
    expect(messy.filter((violation) => violation.severity === 'critical')).toHaveLength(4);
  });

  it('orders critical violations before warnings', () => {
    const firstWarning = messy.findIndex((violation) => violation.severity === 'warning');
    const lastCritical = messy.map((violation) => violation.severity).lastIndexOf('critical');

    expect(lastCritical).toBeLessThan(firstWarning);
  });

  it('never reports two rules on the same file and line', () => {
    const keys = messy.map((violation) => `${violation.file}:${violation.line}`);

    expect(new Set(keys).size).toBe(keys.length);
  });

  it('does not let a NEXT_PUBLIC_ read count as a leaked server secret', () => {
    const leaks = violationsFor(messy, 'leaked_server_secret');

    expect(leaks.map((violation) => violation.file)).not.toContain('src/components/PublicBanner.tsx');
  });

  it('ignores anti-patterns that declare no detect block', async () => {
    const { skills } = await loadSkills();
    const skill = skills.find((entry) => entry.id === 'nextjs-app-router') as ArchitectureSkill;
    const guidanceOnly = new Set(
      skill.antiPatterns.filter((antiPattern) => !antiPattern.detect).map((antiPattern) => antiPattern.id)
    );

    expect(guidanceOnly.has('auth_mechanism_mismatch')).toBe(true);
    expect(messy.some((violation) => guidanceOnly.has(violation.rule))).toBe(false);
  });

  it('keeps parsed facts scoped to one context so fixtures cannot leak into each other', async () => {
    const first = await checkFixture('messy-nextjs');
    const second = await checkFixture('clean-nextjs');

    expect(first.length).toBeGreaterThan(0);
    expect(second).toEqual([]);
  });
});
