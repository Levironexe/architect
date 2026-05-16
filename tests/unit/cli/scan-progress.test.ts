import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { runCli } from '../../../src/cli/index';
import { captureOutput } from '../test-helpers';

describe('scan progress diagnostics', () => {
  it('includes progress-related verbose diagnostics', async () => {
    const output = await captureOutput(async () => {
      expect(await runCli(['scan', path.resolve('tests/fixtures/large-project'), '--verbose', '--no-color'])).toBe(0);
    });

    expect(output.stdout).toContain('Verbose diagnostics');
    expect(output.stdout).toContain('Scan thresholds applied');
  });

  it('keeps JSON output parseable without spinner text', async () => {
    const output = await captureOutput(async () => {
      expect(await runCli(['scan', path.resolve('tests/fixtures/messy-express'), '--json', '--verbose'])).toBe(0);
    });

    expect(() => JSON.parse(output.stdout)).not.toThrow();
    expect(output.stderr).toBe('');
  });
});
