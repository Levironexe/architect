import { describe, expect, it } from 'vitest';

import { renderScanJson } from '../../../src/reporters/scan-json';
import { diagnosticFixture, scanResultFixture, warningFixture } from './scan-output-fixtures';

describe('renderScanJson', () => {
  it('renders a parseable scan output envelope without ANSI styling', () => {
    const output = renderScanJson({
      result: scanResultFixture(),
      targetDir: '/tmp/project',
      verbose: true,
      durationMs: 12,
      warnings: [warningFixture],
      diagnostics: [diagnosticFixture]
    });
    const parsed = JSON.parse(output) as {
      schemaVersion: string;
      command: { name: string; verbose: boolean };
      run: { status: string; outputMode: string };
      warnings: unknown[];
      diagnostics: unknown[];
    };

    expect(parsed.schemaVersion).toBe('1.0');
    expect(parsed.command).toMatchObject({ name: 'scan', verbose: true });
    expect(parsed.run.outputMode).toBe('json');
    expect(parsed.run.status).toBe('partial');
    expect(parsed.warnings).toHaveLength(1);
    expect(parsed.diagnostics).toHaveLength(1);
    expect(output).not.toContain('\u001b[');
  });
});
