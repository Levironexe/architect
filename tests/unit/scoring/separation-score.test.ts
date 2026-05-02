import { describe, expect, it } from 'vitest';

import { scoreSeparation } from '../../../src/scoring/separation-score';
import { classification } from './scoring-fixtures';

describe('scoreSeparation', () => {
  it('rewards files with a single concern', () => {
    const result = scoreSeparation([classification('src/service.ts', ['business_logic', 'business_logic'])]);

    expect(result?.score).toBe(100);
    expect(result?.label).toBe('healthy');
  });

  it('warns on files with two concerns', () => {
    const result = scoreSeparation([classification('src/user.ts', ['routing', 'validation'])]);

    expect(result?.label).toBe('warning');
    expect(result?.reasons.join(' ')).toContain('two concerns');
  });

  it('marks files with three or more concerns as critical', () => {
    const result = scoreSeparation([classification('src/app.ts', ['routing', 'validation', 'data_access'])]);

    expect(result?.label).toBe('critical');
    expect(result?.score).toBeLessThan(50);
    expect(result?.reasons.join(' ')).toContain('three or more concerns');
  });

  it('returns null when classifications are unavailable', () => {
    expect(scoreSeparation(undefined)).toBeNull();
    expect(scoreSeparation([])).toBeNull();
  });
});
