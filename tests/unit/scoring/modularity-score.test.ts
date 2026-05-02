import { describe, expect, it } from 'vitest';

import { scoreModularity } from '../../../src/scoring/modularity-score';
import type { FileAnalysis } from '../../../src/types/analysis';

function file(relativePath: string, loc: number, functions: { loc: number }[] = []): FileAnalysis {
  return {
    path: `/project/${relativePath}`,
    relativePath,
    loc,
    blankLines: 0,
    commentLines: 0,
    totalLines: loc,
    functions: functions.map((item, index) => ({
      name: `fn${index}`,
      paramCount: 0,
      startLine: 1,
      endLine: item.loc,
      loc: item.loc,
      complexity: 1,
      isFlagged: false
    })),
    classes: [],
    imports: [],
    exports: [],
    isOversized: loc > 300,
    hasCriticalComplexity: false,
    parseError: null
  };
}

describe('scoreModularity', () => {
  it('rewards evenly distributed small files and functions', () => {
    const result = scoreModularity([file('a.ts', 30, [{ loc: 10 }]), file('b.ts', 40, [{ loc: 12 }])]);

    expect(result.label).toBe('healthy');
    expect(result.score).toBeGreaterThanOrEqual(90);
  });

  it('penalizes oversized files, large functions, and single-file concentration', () => {
    const result = scoreModularity([file('server.ts', 420, [{ loc: 120 }, { loc: 90 }, { loc: 80 }]), file('tiny.ts', 10)]);

    expect(result.label).toBe('critical');
    expect(result.score).toBeLessThan(50);
    expect(result.reasons.join(' ')).toContain('single file');
  });
});
