import { describe, expect, it } from 'vitest';

import { runCli } from '../../../src/cli/index';
import { captureOutput } from '../test-helpers';

describe('context command', () => {
  it('prints the blueprint for a known skill', async () => {
    const output = await captureOutput(async () => {
      const exitCode = await runCli(['context', '--techstack', 'express-api']);
      expect(exitCode).toBe(0);
    });

    expect(output.stderr).toBe('');
    expect(output.stdout).toContain('# Express.js REST API (express-api)');
    expect(output.stdout).toContain('## Structure');
    expect(output.stdout).toContain('## Separation Rules');
  });

  it('prints multiple blueprints in one response', async () => {
    const output = await captureOutput(async () => {
      const exitCode = await runCli(['context', '--techstack', 'express-api', 'general-js']);
      expect(exitCode).toBe(0);
    });

    expect(output.stdout).toContain('# Express.js REST API (express-api)');
    expect(output.stdout).toContain('# General JavaScript/TypeScript (general-js)');
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