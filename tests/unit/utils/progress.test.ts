import { describe, expect, it } from 'vitest';

import { createProgressDiagnostics, shouldRenderHumanProgress, shouldReportProgress } from '../../../src/utils/progress';

describe('progress helpers', () => {
  it('stays quiet for small scans and non-verbose scans', () => {
    expect(shouldReportProgress(10, true, 1000)).toBe(false);
    expect(shouldReportProgress(1000, false, 1000)).toBe(false);
    expect(createProgressDiagnostics(10, true, 1000)).toEqual([]);
  });

  it('creates coarse diagnostics for verbose large scans', () => {
    const diagnostics = createProgressDiagnostics(5, true, 5);

    expect(diagnostics.length).toBeGreaterThan(1);
    expect(diagnostics[0]?.phase).toBe('discovery');
    expect(diagnostics[0]?.details).toMatchObject({ fileCount: 5, threshold: 5 });
  });

  it('renders human progress only for interactive non-json output', () => {
    expect(shouldRenderHumanProgress({
      json: false,
      verbose: true,
      isInteractive: true,
      stderrIsTTY: true,
      fileCount: 1
    })).toBe(true);
    expect(shouldRenderHumanProgress({
      json: true,
      verbose: true,
      isInteractive: true,
      stderrIsTTY: true,
      fileCount: 1000
    })).toBe(false);
    expect(shouldRenderHumanProgress({
      json: false,
      verbose: true,
      isInteractive: false,
      stderrIsTTY: true,
      fileCount: 1000
    })).toBe(false);
  });
});
