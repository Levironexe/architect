import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { runCli } from '../../../src/cli/index';
import { captureOutput } from '../test-helpers';

describe('scan threshold option', () => {
  it('applies custom LOC and complexity thresholds to scan findings', async () => {
    const output = await captureOutput(async () => {
      expect(await runCli([
        'scan',
        path.resolve('tests/fixtures/clean-project'),
        '--threshold',
        'loc=1,complexity=1',
        '--verbose',
        '--no-color'
      ])).toBe(0);
    });

    expect(output.stdout).toContain('- Flagged files: 1');
    expect(output.stdout).toContain('Scan thresholds applied {"locThreshold":1,"complexityThreshold":1}');
  });

  it('rejects invalid threshold values before scanning', async () => {
    const output = await captureOutput(async () => {
      expect(await runCli(['scan', path.resolve('tests/fixtures/clean-project'), '--threshold', 'loc=-1'])).toBe(3);
    });

    expect(output.stdout).toBe('');
    expect(output.stderr).toContain('positive integer');
    expect(output.stderr).toContain('--threshold loc=300,complexity=15');
  });
});
