import { describe, expect, it } from 'vitest';

import { renderScanReport } from '../../../src/reporters/terminal';
import { captureOutput } from '../test-helpers';
import { scanResultFixture } from './scan-output-fixtures';

describe('terminal health output (metrics-only mode)', () => {
  it('renders overall score and both dimension sub-scores', async () => {
    const result = scanResultFixture();
    result.scores = {
      overall: 82,
      label: 'healthy',
      modularity: { score: 90, weight: 50, label: 'healthy', reasons: ['small files'] },
      duplication: { score: 74, weight: 50, label: 'warning', reasons: ['8% duplication'] }
    };

    const output = await captureOutput(() => renderScanReport(result, { color: false }));

    expect(output.stdout).toContain('Health report');
    expect(output.stdout).toContain('Overall score: 82 healthy');
    expect(output.stdout).toContain('modularity: 90 healthy');
    expect(output.stdout).toContain('duplication: 74 warning');
  });

  it('shows unavailable when no scores computed', async () => {
    const result = scanResultFixture();

    const output = await captureOutput(() => renderScanReport(result, { color: false }));

    expect(output.stdout).toContain('Health report');
    expect(output.stdout).toContain('Unavailable');
  });

  it('does not include concern classification or pattern consistency sections', async () => {
    const result = scanResultFixture();

    const output = await captureOutput(() => renderScanReport(result, { color: false }));

    expect(output.stdout).not.toContain('Concern classification');
    expect(output.stdout).not.toContain('Pattern consistency');
  });
});
