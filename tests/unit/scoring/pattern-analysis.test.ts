import { describe, expect, it } from 'vitest';

import { analyzePatterns } from '../../../src/scoring/pattern-analysis';
import { classification } from './scoring-fixtures';

describe('analyzePatterns', () => {
  it('finds dominant patterns and deviations by concern', () => {
    const findings = analyzePatterns([
      classification('src/users.repository.ts', ['data_access']),
      classification('src/users.model.ts', ['data_access']),
      classification('src/users.route.ts', ['data_access'])
    ]);

    const dataAccess = findings.find((finding) => finding.concern === 'data_access');

    expect(dataAccess?.dominantPattern).toBe('repository');
    expect(dataAccess?.patternCount).toBe(2);
    expect(dataAccess?.deviations[0]?.pattern).toBe('route-handler');
  });

  it('marks concern groups with too little evidence as insufficient', () => {
    const findings = analyzePatterns([classification('src/users.service.ts', ['business_logic'])]);

    expect(findings[0]?.confidence).toBe('insufficient');
    expect(findings[0]?.patternCount).toBe(0);
  });
});
