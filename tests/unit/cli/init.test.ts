import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { runCli } from '../../../src/cli/index';
import * as initRunner from '../../../src/cli/init-runner';
import { captureOutput } from '../test-helpers';

describe('init command', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'architect-init-'));
    cpSync(path.resolve('tests/fixtures/messy-express'), tempDir, { recursive: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('writes Claude guidance files for the messy-express fixture', async () => {
    mkdirSync(path.join(tempDir, '.claude'), { recursive: true });

    const output = await captureOutput(async () => {
      const exitCode = await runCli(['init', tempDir, '--integration', 'claude', '--update']);
      expect(exitCode).toBe(0);
    });

    const planPath = path.join(tempDir, '.claude/skills/architect-plan/SKILL.md');
    const refactorPath = path.join(tempDir, '.claude/skills/architect-refactor/SKILL.md');

    expect(output.stderr).toBe('');
    expect(output.stdout).toContain('Initialized claude guidance with skill express-api');
    expect(existsSync(planPath)).toBe(true);
    expect(existsSync(refactorPath)).toBe(true);
    expect(readFileSync(planPath, 'utf8')).toContain('Express.js REST API');
    expect(readFileSync(planPath, 'utf8')).toContain('server.ts');
  });

  it('supports explicit skill override and generic fallback output', async () => {
    const output = await captureOutput(async () => {
      const exitCode = await runCli(['init', tempDir, '--skill', 'general-js', '--integration', 'generic', '--update']);
      expect(exitCode).toBe(0);
    });

    const genericPlanPath = path.join(tempDir, '.architect/skills/architect-plan/SKILL.md');

    expect(output.stderr).toBe('');
    expect(output.stdout).toContain('Initialized generic guidance with skill general-js');
    expect(existsSync(genericPlanPath)).toBe(true);
    expect(readFileSync(genericPlanPath, 'utf8')).toContain('General JavaScript/TypeScript');
  });

  it('reports empty projects as a non-zero error', async () => {
    const emptyDir = mkdtempSync(path.join(tmpdir(), 'architect-empty-'));

    try {
      const output = await captureOutput(async () => {
        const exitCode = await runCli(['init', emptyDir]);
        expect(exitCode).toBe(3);
      });

      expect(output.stdout).toBe('');
      expect(output.stderr).toContain('No source files found');
    } finally {
      rmSync(emptyDir, { recursive: true, force: true });
    }
  });

  it('warns before overwriting existing files and respects --update', async () => {
    mkdirSync(path.join(tempDir, '.claude'), { recursive: true });
    const existingPath = path.join(tempDir, '.claude/skills/architect-plan/SKILL.md');
    mkdirSync(path.dirname(existingPath), { recursive: true });
    writeFileSync(existingPath, 'existing plan', 'utf8');

    vi.spyOn(initRunner, 'runInitCommand').mockImplementationOnce(async (directory, options, dependencies) => {
      return initRunner.runInitCommand(directory, options, {
        ...dependencies,
        interactiveCheck: () => true,
        confirmOverwrite: async () => false
      });
    });

    const declined = await captureOutput(async () => {
      const exitCode = await runCli(['init', tempDir, '--integration', 'claude']);
      expect(exitCode).toBe(0);
    });

    expect(declined.stdout).toContain('Files skipped:');
    expect(readFileSync(existingPath, 'utf8')).toBe('existing plan');

    const updated = await captureOutput(async () => {
      const exitCode = await runCli(['init', tempDir, '--integration', 'claude', '--update']);
      expect(exitCode).toBe(0);
    });

    expect(updated.stdout).toContain('Files written:');
    expect(readFileSync(existingPath, 'utf8')).not.toBe('existing plan');
  });
});