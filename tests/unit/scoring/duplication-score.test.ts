import { describe, expect, it } from 'vitest';

import { scoreDuplication } from '../../../src/scoring/duplication-score';

describe('scoreDuplication', () => {
  it('maps duplication percentage thresholds to expected scores', () => {
    expect(scoreDuplication({ findings: [], duplicatedLines: 0, duplicationPercentage: 4, isPartial: false }).score).toBe(100);
    expect(scoreDuplication({ findings: [], duplicatedLines: 0, duplicationPercentage: 10, isPartial: false }).score).toBe(80);
    expect(scoreDuplication({ findings: [], duplicatedLines: 0, duplicationPercentage: 20, isPartial: false }).score).toBe(65);
    expect(scoreDuplication({ findings: [], duplicatedLines: 0, duplicationPercentage: 35, isPartial: false }).score).toBe(45);
  });

  it('labels partial duplication data in the reasons', () => {
    const result = scoreDuplication({ findings: [], duplicatedLines: 0, duplicationPercentage: 0, isPartial: true });

    expect(result.reasons.join(' ')).toContain('partial');
  });
});
