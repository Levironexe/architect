import { describe, expect, it } from 'vitest';

import { scoreConsistency } from '../../../src/scoring/consistency-score';
import { patternFixtures } from './scoring-fixtures';

describe('scoreConsistency', () => {
  it('maps one pattern to a healthy score', () => {
    expect(scoreConsistency(patternFixtures.single)?.score).toBe(100);
  });

  it('maps two patterns to a warning score', () => {
    const result = scoreConsistency(patternFixtures.two);

    expect(result?.label).toBe('warning');
    expect(result?.score).toBeLessThan(70);
  });

  it('maps three patterns to a critical degraded score', () => {
    const result = scoreConsistency(patternFixtures.three);

    expect(result?.label).toBe('critical');
    expect(result?.score).toBeLessThanOrEqual(40);
  });

  it('maps four or more patterns to a critical score', () => {
    expect(scoreConsistency(patternFixtures.four)?.score).toBeLessThanOrEqual(10);
  });

  it('returns null for insufficient evidence', () => {
    expect(scoreConsistency(patternFixtures.insufficient)).toBeNull();
  });
});
