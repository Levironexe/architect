import { describe, expect, it } from 'vitest';

import { parseConcernClassifications } from '../../../src/llm/response-parser';
import type { FileClassificationInput } from '../../../src/types/concern';

describe('parseConcernClassifications', () => {
  it('parses valid file classifications and calculates dominant and mixed concerns', () => {
    const parsed = parseConcernClassifications(
      JSON.stringify({
        files: [
          {
            file: 'src/app.ts',
            functions: [
              { name: 'routeUser', concern: 'routing', confidence: 0.9, isMisplaced: true, reason: 'belongs in routes' },
              { name: 'validateUser', concern: 'validation', confidence: 0.8, isMisplaced: false },
              { name: 'findUser', concern: 'data_access', confidence: 0.7, isMisplaced: false }
            ]
          }
        ]
      }),
      [createInput()]
    );

    expect(parsed.warnings).toEqual([]);
    expect(parsed.classifications[0]?.dominantConcern).toBe('routing');
    expect(parsed.classifications[0]?.mixedConcerns).toBe(true);
    expect(parsed.classifications[0]?.functions[0]?.isMisplaced).toBe(true);
  });

  it('maps unknown concerns to unclassified with warnings', () => {
    const parsed = parseConcernClassifications(
      JSON.stringify({
        files: [{ file: 'src/app.ts', functions: [{ name: 'routeUser', concern: 'banana', confidence: 2 }] }]
      }),
      [createInput()]
    );

    expect(parsed.classifications[0]?.functions[0]?.concern).toBe('unclassified');
    expect(parsed.classifications[0]?.functions[0]?.confidence).toBe(1);
    expect(parsed.warnings.join(' ')).toContain('Unknown concern');
  });

  it('returns unclassified entries for invalid JSON', () => {
    const parsed = parseConcernClassifications('not json', [createInput()]);

    expect(parsed.classifications[0]?.dominantConcern).toBe('unclassified');
    expect(parsed.warnings[0]).toContain('invalid JSON');
  });
});

function createInput(): FileClassificationInput {
  return {
    relativePath: 'src/app.ts',
    imports: [],
    functions: [
      { name: 'routeUser', paramCount: 2, startLine: 1, endLine: 3 },
      { name: 'validateUser', paramCount: 1, startLine: 4, endLine: 5 },
      { name: 'findUser', paramCount: 1, startLine: 6, endLine: 8 }
    ]
  };
}
