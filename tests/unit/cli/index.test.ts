import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

import { captureOutput } from '../test-helpers';
import { runCli } from '../../../src/cli/index';

const { version } = createRequire(import.meta.url)('../../../package.json') as { version: string };

describe('runCli', () => {
  it('prints help with scan and skill commands (plan removed)', async () => {
    const output = await captureOutput(async () => {
      await runCli(['--help']);
    });

    expect(output.stdout).toContain('Usage: architect');
    expect(output.stdout).toContain('scan');
    expect(output.stdout).not.toContain('plan');
    expect(output.stdout).toContain('skill');
    expect(output.stderr).toBe('');
  });

  it('prints the configured version', async () => {
    const output = await captureOutput(async () => {
      await runCli(['--version']);
    });

    expect(output.stdout.trim()).toBe(version);
    expect(output.stderr).toBe('');
  });

  it('reports a missing scan directory to stderr and returns a non-zero exit code', async () => {
    const output = await captureOutput(async () => {
      const exitCode = await runCli(['scan']);
      expect(exitCode).toBe(3);
    });

    expect(output.stdout).toBe('');
    expect(output.stderr).toContain('Target directory required');
    expect(output.stderr).toContain('architect scan .');
  });
});
