import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { runCli } from '../../../src/cli/index';
import { captureOutput } from '../test-helpers';

describe('scan output modes', () => {
  it('emits parseable JSON for clean scans', async () => {
    const output = await captureOutput(async () => {
      expect(await runCli(['scan', path.resolve('tests/fixtures/clean-project'), '--json'])).toBe(0);
    });
    const parsed = JSON.parse(output.stdout) as { schemaVersion: string; result: { summary: { totalFiles: number } }; diagnostics: unknown[] };

    expect(output.stderr).toBe('');
    expect(parsed.schemaVersion).toBe('1.0');
    expect(parsed.result.summary.totalFiles).toBe(1);
    expect(output.stdout).not.toContain('\u001b[');
  });

  it('includes warnings structurally for partial scans', async () => {
    const output = await captureOutput(async () => {
      expect(await runCli(['scan', path.resolve('tests/fixtures/broken-project'), '--json', '--verbose'])).toBe(0);
    });
    const parsed = JSON.parse(output.stdout) as { warnings: Array<{ code: string }>; diagnostics: unknown[] };

    expect(output.stderr).toBe('');
    expect(parsed.warnings.some((warning) => warning.code === 'parse_error')).toBe(true);
    expect(parsed.diagnostics.length).toBeGreaterThan(0);
  });

  it('renders verbose terminal output without breaking normal report sections', async () => {
    const output = await captureOutput(async () => {
      expect(await runCli(['scan', path.resolve('tests/fixtures/messy-express'), '--verbose', '--no-color'])).toBe(0);
    });

    expect(output.stdout).toContain('Architect scan:');
    expect(output.stdout).toContain('Verbose diagnostics');
    expect(output.stdout).toContain('Scan thresholds applied');
  });

  it('preserves status words without ANSI codes in no-color mode', async () => {
    const output = await captureOutput(async () => {
      expect(await runCli(['scan', path.resolve('tests/fixtures/messy-express'), '--no-color'])).toBe(0);
    });

    expect(output.stdout).toContain('OVERSIZED');
    expect(output.stdout).toContain('CRITICAL modularity');
    expect(output.stdout).not.toContain('\u001b[');
  });
});
