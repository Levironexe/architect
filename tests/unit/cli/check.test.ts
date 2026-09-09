import { mkdtempSync, readFileSync, rmSync, cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { runCli } from '../../../src/cli/index';
import { captureOutput } from '../test-helpers';

const temporaryDirs: string[] = [];

function copyFixture(fixture: string): string {
  const target = mkdtempSync(path.join(tmpdir(), 'architect-check-'));
  cpSync(path.resolve('tests/fixtures', fixture), target, { recursive: true });
  temporaryDirs.push(target);
  return target;
}

afterEach(() => {
  while (temporaryDirs.length > 0) {
    rmSync(temporaryDirs.pop()!, { recursive: true, force: true });
  }
});

describe('check command', () => {
  it('exits 1 and reports every violation for a messy project', async () => {
    const output = await captureOutput(async () => {
      expect(await runCli(['check', path.resolve('tests/fixtures/messy-nextjs'), '--no-color'])).toBe(1);
    });

    expect(output.stdout).toContain('direct_db_in_page');
    expect(output.stdout).toContain('11 violations (4 critical, 7 warning)');
    expect(output.stdout).toContain('nextjs-app-router');
  });

  it('exits 0 for a clean project', async () => {
    const output = await captureOutput(async () => {
      expect(await runCli(['check', path.resolve('tests/fixtures/clean-nextjs'), '--no-color'])).toBe(0);
    });

    expect(output.stdout).toContain('No architectural violations');
  });

  it('exits 2 when no supported stack is detected', async () => {
    const output = await captureOutput(async () => {
      expect(await runCli(['check', path.resolve('tests/fixtures/clean-project'), '--no-color'])).toBe(2);
    });

    expect(output.stderr).toContain('No supported stack detected');
  });

  it('exits 2 when the target directory does not exist', async () => {
    const output = await captureOutput(async () => {
      expect(await runCli(['check', 'does-not-exist', '--no-color'])).toBe(2);
    });

    expect(output.stderr).toContain('Target directory does not exist');
  });

  it('emits JSON matching the documented schema', async () => {
    const output = await captureOutput(async () => {
      expect(await runCli(['check', path.resolve('tests/fixtures/messy-nextjs'), '--json'])).toBe(1);
    });

    const payload = JSON.parse(output.stdout) as {
      stack: string;
      files_checked: number;
      violations: Array<Record<string, unknown>>;
      summary: Record<string, number>;
    };

    expect(payload.stack).toBe('nextjs-app-router');
    expect(payload.files_checked).toBeGreaterThan(0);
    expect(payload.violations).toHaveLength(11);
    expect(Object.keys(payload.violations[0]!).sort()).toEqual(
      ['file', 'fix', 'line', 'message', 'rule', 'severity']
    );
    expect(payload.summary).toEqual({ critical: 4, warning: 7, info: 0 });
  });

  it('lists rules and marks the agent-only one as not checkable', async () => {
    const output = await captureOutput(async () => {
      expect(await runCli(['check', '--list-rules', '--no-color'])).toBe(0);
    });

    expect(output.stdout).toContain('direct_db_in_page');
    expect(output.stdout).toContain('auth_mechanism_mismatch (agent guidance only)');
  });

  it('lists rules as JSON', async () => {
    const output = await captureOutput(async () => {
      expect(await runCli(['check', '--list-rules', '--json'])).toBe(0);
    });

    const payload = JSON.parse(output.stdout) as { rules: Array<{ rule: string; checkable: boolean }> };
    const checkable = payload.rules.filter((rule) => rule.checkable);

    expect(checkable).toHaveLength(10);
    expect(payload.rules.find((rule) => rule.rule === 'auth_mechanism_mismatch')?.checkable).toBe(false);
  });

  it('writes a baseline instead of reporting', async () => {
    const target = copyFixture('messy-nextjs');

    await captureOutput(async () => {
      expect(await runCli(['check', target, '--baseline'])).toBe(0);
    });

    const baseline = JSON.parse(readFileSync(path.join(target, '.architect/baseline.json'), 'utf8')) as {
      violations: number;
      critical: number;
      stack: string;
    };

    expect(baseline.violations).toBe(11);
    expect(baseline.critical).toBe(4);
    expect(baseline.stack).toBe('nextjs-app-router');
  });

  it('reports the missing_layer rule when a required directory is absent', async () => {
    const target = mkdtempSync(path.join(tmpdir(), 'architect-layer-'));
    temporaryDirs.push(target);
    writeFileSync(path.join(target, 'package.json'), JSON.stringify({ dependencies: { next: '^15.0.0' } }));
    mkdirSync(path.join(target, 'app'), { recursive: true });
    writeFileSync(path.join(target, 'app/page.tsx'), 'export default function Page() {\n  return <div />;\n}\n');

    const output = await captureOutput(async () => {
      await runCli(['check', target, '--json']);
    });

    const payload = JSON.parse(output.stdout) as { violations: Array<{ rule: string; file: string }> };
    const missing = payload.violations.filter((violation) => violation.rule === 'missing_layer');

    expect(missing.map((violation) => violation.file)).toEqual(expect.arrayContaining(['components/', 'lib/']));
  });

  it('drops the rules named by --ignore', async () => {
    const output = await captureOutput(async () => {
      await runCli(['check', path.resolve('tests/fixtures/messy-nextjs'), '--json', '--ignore', 'oversized_extraction,alert_for_errors']);
    });

    const payload = JSON.parse(output.stdout) as { violations: Array<{ rule: string }> };
    const rules = new Set(payload.violations.map((violation) => violation.rule));

    expect(payload.violations).toHaveLength(9);
    expect(rules.has('oversized_extraction')).toBe(false);
    expect(rules.has('alert_for_errors')).toBe(false);
  });

  it('lets --ignore silence missing_layer too', async () => {
    const target = mkdtempSync(path.join(tmpdir(), 'architect-layer-'));
    temporaryDirs.push(target);
    writeFileSync(path.join(target, 'package.json'), JSON.stringify({ dependencies: { next: '^15.0.0' } }));
    mkdirSync(path.join(target, 'app'), { recursive: true });
    writeFileSync(path.join(target, 'app/page.tsx'), 'export default function Page() {\n  return <div />;\n}\n');

    const output = await captureOutput(async () => {
      await runCli(['check', target, '--json', '--ignore', 'missing_layer']);
    });

    const payload = JSON.parse(output.stdout) as { violations: Array<{ rule: string }> };

    expect(payload.violations.some((violation) => violation.rule === 'missing_layer')).toBe(false);
  });
});
