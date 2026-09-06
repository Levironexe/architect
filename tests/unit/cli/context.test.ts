import { describe, expect, it } from 'vitest';

import { runCli } from '../../../src/cli/index';
import { captureOutput } from '../test-helpers';

describe('context command', () => {
  it('prints the blueprint for a known skill', async () => {
    const output = await captureOutput(async () => {
      const exitCode = await runCli(['context', '--techstack', 'nextjs-app-router']);
      expect(exitCode).toBe(0);
    });

    expect(output.stderr).toBe('');
    expect(output.stdout).toContain('# Next.js App Router (nextjs-app-router)');
    expect(output.stdout).toContain('## Structure');
    expect(output.stdout).toContain('## Separation Rules');
  });

  it('prints the blueprint when a single stack is requested', async () => {
    const output = await captureOutput(async () => {
      const exitCode = await runCli(['context', '--techstack', 'nextjs-app-router']);
      expect(exitCode).toBe(0);
    });

    expect(output.stdout).toContain('# Next.js App Router (nextjs-app-router)');
  });

  it('reports unknown skills on stderr', async () => {
    const output = await captureOutput(async () => {
      const exitCode = await runCli(['context', '--techstack', 'does-not-exist']);
      expect(exitCode).toBe(3);
    });

    expect(output.stdout).toBe('');
    expect(output.stderr).toContain('Unknown architecture skill');
  });
});