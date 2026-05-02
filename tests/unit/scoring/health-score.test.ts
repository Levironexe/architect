import { describe, expect, it } from 'vitest';

import { scoreDuplication } from '../../../src/scoring/duplication-score';
import { calculateHealthScore, calculatePartialHealthScore, clampScore, labelForScore, unavailableDimension } from '../../../src/scoring/health-score';
import { scoreModularity } from '../../../src/scoring/modularity-score';
import { dimension } from './scoring-fixtures';

describe('calculatePartialHealthScore', () => {
  it('combines modularity and duplication using available weights', () => {
    const result = calculatePartialHealthScore(
      { score: 70, weight: 25, label: 'warning', reasons: [] },
      { score: 100, weight: 20, label: 'healthy', reasons: [] }
    );

    expect(result.availableWeight).toBe(45);
    expect(result.partialHealthScore).toBe(83);
  });

  it('can be composed from dimension scorers', () => {
    const result = calculatePartialHealthScore(
      scoreModularity([]),
      scoreDuplication({ findings: [], duplicatedLines: 0, duplicationPercentage: 0, isPartial: false })
    );

    expect(result.partialHealthScore).toBeGreaterThan(0);
  });
});

describe('health score helpers', () => {
  it('clamps scores and maps labels consistently', () => {
    expect(clampScore(110)).toBe(100);
    expect(clampScore(-5)).toBe(0);
    expect(labelForScore(80)).toBe('healthy');
    expect(labelForScore(50)).toBe('warning');
    expect(labelForScore(49)).toBe('critical');
  });

  it('creates unavailable dimensions without scoring them as failures', () => {
    const result = unavailableDimension('separation', 30, 'classification unavailable');

    expect(result.score).toBeNull();
    expect(result.label).toBe('unavailable');
    expect(result.state).toBe('unavailable');
  });

  it('combines all dimensions into a complete weighted health score', () => {
    const result = calculateHealthScore({
      separation: dimension('separation', 70, 30),
      consistency: dimension('consistency', 40, 25),
      modularity: dimension('modularity', 100, 25),
      duplication: dimension('duplication', 100, 20)
    });

    expect(result.health.state).toBe('complete');
    expect(result.health.score).toBe(76);
    expect(result.health.label).toBe('warning');
  });

  it('marks missing dimensions as partial and excludes them from weighted calculation', () => {
    const result = calculateHealthScore({
      separation: unavailableDimension('separation', 30, 'classification unavailable'),
      consistency: unavailableDimension('consistency', 25, 'pattern evidence unavailable'),
      modularity: dimension('modularity', 60, 25),
      duplication: dimension('duplication', 100, 20)
    });

    expect(result.health.state).toBe('partial');
    expect(result.health.availableWeight).toBe(45);
    expect(result.health.score).toBe(78);
  });
});
