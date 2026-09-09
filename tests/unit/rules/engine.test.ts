import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
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

  describe('false positives found against real repositories', () => {
    it('does not flag process.env.NODE_ENV in a client component', () => {
      expect(clean.filter((violation) => violation.file.endsWith('DebugBadge.tsx'))).toEqual([]);
    });

    it('does not flag process.env in a tool config file', () => {
      expect(clean.filter((violation) => violation.file.endsWith('playwright.config.ts'))).toEqual([]);
    });

    it('does not flag process.env in a test file', () => {
      expect(clean.filter((violation) => violation.file.includes('tests/'))).toEqual([]);
    });

    it('does not flag a components/ tree nested inside app/ importing a sibling layer', () => {
      expect(clean.filter((violation) => violation.file.endsWith('NestedCard.tsx'))).toEqual([]);
    });
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

  describe('one hop through a workspace package or a local file', () => {
    let monorepo: RuleViolation[];

    beforeAll(async () => {
      monorepo = await checkFixture('monorepo-nextjs');
    });

    it('flags a page importing the client binding from a workspace package', () => {
      const found = violationsFor(monorepo, 'direct_db_in_page').map((v) => v.file);

      expect(found).toContain('apps/web/src/app/page.tsx');
    });

    it('flags a route handler importing the client binding from a workspace package', () => {
      const found = violationsFor(monorepo, 'direct_db_in_route').map((v) => v.file);

      expect(found).toEqual(['apps/web/src/app/api/users/route.ts']);
    });

    it('flags a page importing the client binding from a local file that imports prisma', () => {
      const found = violationsFor(monorepo, 'direct_db_in_page').map((v) => v.file);

      expect(found).toContain('apps/web/src/app/local/page.tsx');
    });

    it('does not flag a helper binding from a package that merely depends on prisma', () => {
      expect(monorepo.map((v) => v.file)).not.toContain('apps/web/src/app/users/page.tsx');
    });

    it('does not flag a type-only import of the client package', () => {
      expect(monorepo.map((v) => v.file)).not.toContain('apps/web/src/app/types/page.tsx');
    });

    it('does not flag a page calling a lib helper that uses the client', () => {
      expect(monorepo.map((v) => v.file)).not.toContain('apps/web/src/app/helper/page.tsx');
    });

    it('finds exactly three criticals and nothing else', () => {
      expect(monorepo).toHaveLength(3);
      expect(monorepo.every((v) => v.severity === 'critical')).toBe(true);
    });
  });

  describe('suppression comments', () => {
    async function runOn(source: string): Promise<RuleViolation[]> {
      const rootDir = mkdtempSync(path.join(tmpdir(), 'architect-ignore-'));
      writeFileSync(path.join(rootDir, 'package.json'), JSON.stringify({ dependencies: { next: '^15.0.0' } }));
      const file = path.join(rootDir, 'app', 'Widget.tsx');
      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(file, source);
      const files = [await analyzeFile(file, rootDir)];
      const { skills } = await loadSkills();
      const skill = skills.find((entry) => entry.id === 'nextjs-app-router') as ArchitectureSkill;
      return runRules(skill, createRuleContext(files, rootDir));
    }

    const widget = (comment: string) =>
      `'use client';\nexport function Widget() {\n  function go() {\n${comment}    alert('x');\n  }\n  return <button onClick={go} />;\n}\n`;

    it('fires without the comment', async () => {
      expect(violationsFor(await runOn(widget('')), 'alert_for_errors')).toHaveLength(1);
    });

    it('architect-ignore-next-line silences the line beneath it', async () => {
      expect(violationsFor(await runOn(widget('    // architect-ignore-next-line\n')), 'alert_for_errors')).toEqual([]);
    });

    it('architect-ignore-file silences the whole file', async () => {
      const source = `// architect-ignore-file\n${widget('')}`;
      expect(await runOn(source)).toEqual([]);
    });

    it('the clean fixture keeps its suppressed files silent', () => {
      expect(clean.map((v) => v.file)).not.toContain('src/components/Suppressed.tsx');
      expect(clean.map((v) => v.file)).not.toContain('src/lib/legacy.ts');
    });
  });

  describe('scoped warnings', () => {
    it('does not call a long test file oversized', () => {
      expect(clean.map((v) => v.file)).not.toContain('tests/unit/big.test.ts');
    });

    it('does not flag env reads inside a library package', () => {
      expect(clean.map((v) => v.file)).not.toContain('packages/mailer/src/index.ts');
    });

    it('reports the real line count in the oversized message', () => {
      const found = violationsFor(messy, 'oversized_extraction')[0];

      expect(found?.message).toMatch(/^File is \d+ lines, over the 300-line ceiling/);
      expect(found?.message).not.toContain('{value}');
    });
  });

  describe('client_data_fetching_by_default precision', () => {
    async function runOn(source: string): Promise<RuleViolation[]> {
      const rootDir = mkdtempSync(path.join(tmpdir(), 'architect-fetch-'));
      writeFileSync(path.join(rootDir, 'package.json'), JSON.stringify({ dependencies: { next: '^15.0.0' } }));
      const file = path.join(rootDir, 'app', 'Widget.tsx');
      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(file, source);
      const files = [await analyzeFile(file, rootDir)];
      const { skills } = await loadSkills();
      const skill = skills.find((entry) => entry.id === 'nextjs-app-router') as ArchitectureSkill;
      return violationsFor(runRules(skill, createRuleContext(files, rootDir)), 'client_data_fetching_by_default');
    }

    const client = (body: string) =>
      `'use client';\nimport { useEffect, useState } from 'react';\nexport function Widget() {\n  const [d, setD] = useState(null);\n${body}\n  return <div>{String(d)}</div>;\n}\n`;

    it('fires on a GET inside a useEffect callback', async () => {
      const source = client(`  useEffect(() => {\n    void fetch('/api/x').then((r) => r.json()).then(setD);\n  }, []);`);
      expect(await runOn(source)).toHaveLength(1);
    });

    it('fires when the fetch sits in an inner async function inside the effect', async () => {
      const source = client(`  useEffect(() => {\n    const run = async () => { setD(await (await fetch('/api/x')).json()); };\n    void run();\n  }, []);`);
      expect(await runOn(source)).toHaveLength(1);
    });

    it('does not fire on a POST inside a useEffect callback', async () => {
      const source = client(`  useEffect(() => {\n    void fetch('/api/track', { method: 'POST', body: '{}' });\n  }, []);`);
      expect(await runOn(source)).toEqual([]);
    });

    it('does not fire on a fetch in an event handler, even with a useEffect elsewhere', async () => {
      const source = client(`  useEffect(() => { document.title = 'x'; }, []);\n  async function onClick() { setD(await (await fetch('/api/x')).json()); }`);
      expect(await runOn(source)).toEqual([]);
    });

    it('does not fire on a fetch inside a useCallback', async () => {
      const source = `'use client';\nimport { useCallback, useEffect } from 'react';\nexport function Widget() {\n  const load = useCallback(async () => { await fetch('/api/x'); }, []);\n  useEffect(() => { void load(); }, [load]);\n  return null;\n}\n`;
      expect(await runOn(source)).toEqual([]);
    });

    it('keeps the clean-fixture forms and beacons silent', () => {
      expect(clean.map((v) => v.file)).not.toContain('src/components/BookingForm.tsx');
      expect(clean.map((v) => v.file)).not.toContain('src/components/PageViewBeacon.tsx');
    });

    it('still fires on the messy fixture page that loads in an effect', () => {
      expect(violationsFor(messy, 'client_data_fetching_by_default').map((v) => v.file)).toEqual(['src/app/users/page.tsx']);
    });
  });
});
