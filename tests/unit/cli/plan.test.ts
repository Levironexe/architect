import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { runCli } from '../../../src/cli/index';
import { captureOutput } from '../test-helpers';

describe('plan command', () => {
  it('reports a nonexistent target directory on stderr with exit code 3', async () => {
    const output = await captureOutput(async () => {
      const exitCode = await runCli(['plan', 'does-not-exist']);
      expect(exitCode).toBe(3);
    });

    expect(output.stdout).toBe('');
    expect(output.stderr).toContain('Target directory does not exist');
  });

  it('generates terminal roadmap output by default without ANSI codes when requested', async () => {
    const fixturePath = path.resolve('tests/fixtures/messy-express');

    const output = await captureOutput(async () => {
      const exitCode = await runCli(['plan', fixturePath, '--no-color']);
      expect(exitCode).toBe(0);
    });

    expect(output.stderr).toBe('');
    expect(output.stdout).toContain('Refactoring plan');
    expect(output.stdout).toContain('Prepare target structure');
    expect(output.stdout).toContain('target');
    expect(output.stdout).toContain('dependencies');
    expect(output.stdout).not.toContain('\u001b[');
  });

  it('renders markdown, json, and prompt formats from the same plan', async () => {
    const fixturePath = path.resolve('tests/fixtures/messy-express');

    const markdown = await captureOutput(async () => {
      expect(await runCli(['plan', fixturePath, '--format', 'md', '--no-color'])).toBe(0);
    });
    const json = await captureOutput(async () => {
      expect(await runCli(['plan', fixturePath, '--format', 'json'])).toBe(0);
    });
    const prompt = await captureOutput(async () => {
      expect(await runCli(['plan', fixturePath, '--format', 'prompt', '--no-color'])).toBe(0);
    });
    const parsed = JSON.parse(json.stdout) as { phases: Array<{ steps: unknown[] }> };
    const stepCount = parsed.phases.flatMap((phase) => phase.steps).length;

    expect(markdown.stdout).toContain('# Refactoring Plan');
    expect(markdown.stdout.match(/^- \[ \] \*\*/gm)).toHaveLength(stepCount);
    expect(prompt.stdout).toContain('SAFETY CONSTRAINTS');
    expect(prompt.stdout).toContain('ORDERED PLAN');
  });

  it('rejects unsupported formats without mixed stdout output', async () => {
    const fixturePath = path.resolve('tests/fixtures/messy-express');

    const output = await captureOutput(async () => {
      const exitCode = await runCli(['plan', fixturePath, '--format', 'xml']);
      expect(exitCode).toBe(3);
    });

    expect(output.stdout).toBe('');
    expect(output.stderr).toContain('Unsupported plan format');
  });
});
