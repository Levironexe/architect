import { describe, expect, it } from 'vitest';

import { runCli } from '../../../src/cli/index';
import { captureOutput } from '../test-helpers';

describe('scan UX options', () => {
  it('reports a missing non-interactive target directory with a next action', async () => {
    const output = await captureOutput(async () => {
      expect(await runCli(['scan'])).toBe(3);
    });

    expect(output.stdout).toBe('');
    expect(output.stderr).toContain('Target directory required');
    expect(output.stderr).toContain('architect scan .');
  });

  it('rejects --provider as an unknown option (flag removed)', async () => {
    const output = await captureOutput(async () => {
      const exitCode = await runCli(['scan', '.', '--provider', 'claude']);
      expect(exitCode).not.toBe(0);
    });

    expect(output.stdout).toBe('');
  });
});
