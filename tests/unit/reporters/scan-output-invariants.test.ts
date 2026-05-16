import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { runCli } from '../../../src/cli/index';
import { captureOutput } from '../test-helpers';

describe('scan output invariants', () => {
  it('preserves core counts between terminal and JSON scan output', async () => {
    const fixturePath = path.resolve('tests/fixtures/messy-express');
    const terminal = await captureOutput(async () => {
      expect(await runCli(['scan', fixturePath, '--no-color'])).toBe(0);
    });
    const json = await captureOutput(async () => {
      expect(await runCli(['scan', fixturePath, '--json'])).toBe(0);
    });
    const parsed = JSON.parse(json.stdout) as {
      result: {
        summary: {
          totalFiles: number;
          skippedFiles: number;
        };
        issues: unknown[];
      };
    };

    expect(terminal.stdout).toContain(`- Files scanned: ${parsed.result.summary.totalFiles}`);
    expect(terminal.stdout).toContain(`- Skipped files: ${parsed.result.summary.skippedFiles}`);
    expect(parsed.result.issues.length).toBeGreaterThan(0);
  });
});
