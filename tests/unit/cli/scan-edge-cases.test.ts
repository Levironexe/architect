import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { runCli } from '../../../src/cli/index';
import { captureOutput } from '../test-helpers';

describe('scan edge cases', () => {
  it('handles empty directories and one-file projects without failing', async () => {
    const emptyOutput = await captureOutput(async () => {
      expect(await runCli(['scan', path.resolve('tests/fixtures/empty-project'), '--no-color'])).toBe(0);
    });
    const oneFileOutput = await captureOutput(async () => {
      expect(await runCli(['scan', path.resolve('tests/fixtures/clean-project'), '--no-color'])).toBe(0);
    });

    expect(emptyOutput.stdout).toContain('No supported JS/TS files found');
    expect(oneFileOutput.stdout).toContain('- Files scanned: 1');
  });

  it('continues after syntax errors and reports partial analysis warnings', async () => {
    const output = await captureOutput(async () => {
      expect(await runCli(['scan', path.resolve('tests/fixtures/broken-project'), '--no-color'])).toBe(0);
    });

    expect(output.stderr).toContain('WARN  Failed to parse broken.ts');
    expect(output.stderr).toContain('Skipped 1 file due to syntax errors');
    expect(output.stderr).toContain('Run with --verbose');
    expect(output.stderr).toContain('Dependency and duplication findings may be partial');
  });
});
