import { describe, expect, it } from 'vitest';

import { captureOutput } from '../test-helpers';
import { runCli } from '../../../src/cli/index';

describe('runCli', () => {
  it('prints help with scan, plan, and skill commands', async () => {
    const output = await captureOutput(async () => {
      await runCli(['--help']);
    });

    expect(output.stdout).toContain('Usage: architect');
    expect(output.stdout).toContain('scan');
    expect(output.stdout).toContain('plan');
    expect(output.stdout).toContain('skill');
    expect(output.stderr).toBe('');
  });

  it('prints the configured version', async () => {
    const output = await captureOutput(async () => {
      await runCli(['--version']);
    });

    expect(output.stdout.trim()).toBe('0.1.0');
    expect(output.stderr).toBe('');
  });

  it('reports a missing scan directory to stderr and returns a non-zero exit code', async () => {
    const output = await captureOutput(async () => {
      const exitCode = await runCli(['scan']);
      expect(exitCode).toBe(1);
    });

    expect(output.stdout).toBe('');
    expect(output.stderr).toContain('missing required argument');
  });
});