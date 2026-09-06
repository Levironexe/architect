import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

import { captureOutput } from '../test-helpers';
import { runCli } from '../../../src/cli/index';

const { version } = createRequire(import.meta.url)('../../../package.json') as { version: string };

describe('runCli', () => {
  it('prints help listing only check, init and verify', async () => {
    const output = await captureOutput(async () => {
      await runCli(['--help']);
    });

    expect(output.stdout).toContain('Usage: architect');
    expect(output.stdout).toContain('check');
    expect(output.stdout).toContain('init');
    expect(output.stdout).toContain('verify');
    expect(output.stdout).not.toContain('scan');
    expect(output.stdout).not.toContain('diff');
    expect(output.stdout).not.toContain('status');
    expect(output.stderr).toBe('');
  });

  it('prints the configured version', async () => {
    const output = await captureOutput(async () => {
      await runCli(['--version']);
    });

    expect(output.stdout.trim()).toBe(version);
    expect(output.stderr).toBe('');
  });

  it('reports a missing check directory to stderr with exit code 2', async () => {
    const output = await captureOutput(async () => {
      const exitCode = await runCli(['check', 'does-not-exist']);
      expect(exitCode).toBe(2);
    });

    expect(output.stdout).toBe('');
    expect(output.stderr).toContain('Target directory does not exist');
    expect(output.stderr).toContain('architect check <directory>');
  });
});
