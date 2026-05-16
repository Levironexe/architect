import { describe, expect, it } from 'vitest';

import { calculateHealthScore, clampScore, labelForScore } from '../../../src/scoring/health-score';
import { scoreDuplication } from '../../../src/scoring/duplication-score';
import { scoreModularity } from '../../../src/scoring/modularity-score';

describe('calculateHealthScore', () => {
  it('computes overall score as 50/50 weighted average of modularity and duplication', () => {
    const result = calculateHealthScore(
      { score: 80, weight: 50, label: 'healthy', reasons: [] },
      { score: 60, weight: 50, label: 'warning', reasons: [] }
    );

    expect(result.overall).toBe(70);
    expect(result.label).toBe('warning');
  });

  it('returns healthy label when both dimensions are high', () => {
    const result = calculateHealthScore(
      { score: 100, weight: 50, label: 'healthy', reasons: [] },
      { score: 100, weight: 50, label: 'healthy', reasons: [] }
    );

    expect(result.overall).toBe(100);
    expect(result.label).toBe('healthy');
  });

  it('returns critical label when both dimensions are low', () => {
    const result = calculateHealthScore(
      { score: 20, weight: 50, label: 'critical', reasons: [] },
      { score: 10, weight: 50, label: 'critical', reasons: [] }
    );

    expect(result.overall).toBe(15);
    expect(result.label).toBe('critical');
  });

  it('includes modularity and duplication sub-scores in result', () => {
    const modularity = { score: 90, weight: 50, label: 'healthy' as const, reasons: ['ok'] };
    const duplication = { score: 70, weight: 50, label: 'warning' as const, reasons: ['10% dup'] };
    const result = calculateHealthScore(modularity, duplication);

    expect(result.modularity).toBe(modularity);
    expect(result.duplication).toBe(duplication);
  });

  it('can be composed from real dimension scorers', () => {
    const result = calculateHealthScore(
      scoreModularity([]),
      scoreDuplication({ findings: [], duplicatedLines: 0, duplicationPercentage: 0, isPartial: false })
    );

    expect(result.overall).toBeGreaterThan(0);
    expect(['healthy', 'warning', 'critical']).toContain(result.label);
  });
});

describe('health score helpers', () => {
  it('clamps scores to 0-100 range', () => {
    expect(clampScore(110)).toBe(100);
    expect(clampScore(-5)).toBe(0);
    expect(clampScore(75)).toBe(75);
  });

  it('maps score thresholds to correct labels', () => {
    expect(labelForScore(80)).toBe('healthy');
    expect(labelForScore(79)).toBe('warning');
    expect(labelForScore(50)).toBe('warning');
    expect(labelForScore(49)).toBe('critical');
  });
});
