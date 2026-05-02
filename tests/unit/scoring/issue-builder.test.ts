import { describe, expect, it } from 'vitest';

import { buildIssues, createReportGuidance } from '../../../src/scoring/issue-builder';
import type { ScanResult } from '../../../src/types/analysis';
import { classification } from './scoring-fixtures';

describe('issue builder', () => {
  it('sorts critical issues before warnings and info-like lower priority entries', () => {
    const issues = buildIssues(createResult());

    expect(issues[0]?.severity).toBe('critical');
    expect(issues.every((issue) => issue.suggestion.length > 0)).toBe(true);
    expect(issues.map((issue) => issue.category)).toContain('separation');
    expect(issues.map((issue) => issue.category)).toContain('complexity');
  });

  it('does not create false critical issues for clean results', () => {
    const clean = createResult();
    clean.files[0] = { ...clean.files[0]!, isOversized: false, loc: 20, functions: [] };
    clean.classifications = [classification('src/service.ts', ['business_logic'])];
    clean.patternFindings = [];
    clean.duplication.duplicationPercentage = 0;
    clean.dependencyGraph.hotspots = [];

    expect(buildIssues(clean).filter((issue) => issue.severity === 'critical')).toEqual([]);
  });

  it('creates roadmap guidance', () => {
    const result = createResult();
    result.issues = buildIssues(result);

    expect(createReportGuidance(result).command).toBe('architect plan');
    expect(createReportGuidance(result).message).toContain('Critical');
  });
});

function createResult(): ScanResult {
  return {
    summary: {
      targetDir: '/tmp/project',
      totalFiles: 1,
      skippedFiles: 0,
      totalLoc: 400,
      totalLines: 400,
      flaggedFiles: 1,
      flaggedFunctions: 1,
      dependencyHotspots: 1,
      circularDependencies: 0,
      duplicateFindings: 0,
      duplicatedLines: 0,
      scanDurationMs: 1
    },
    files: [
      {
        path: '/tmp/project/src/app.ts',
        relativePath: 'src/app.ts',
        loc: 400,
        blankLines: 0,
        commentLines: 0,
        totalLines: 400,
        functions: [
          {
            name: 'doEverything',
            paramCount: 0,
            startLine: 1,
            endLine: 120,
            loc: 120,
            complexity: 20,
            isFlagged: true
          }
        ],
        classes: [],
        imports: [],
        exports: [],
        isOversized: true,
        hasCriticalComplexity: true,
        parseError: null
      }
    ],
    parseErrors: [],
    dependencyGraph: {
      nodes: [],
      circularDependencies: [],
      hotspots: [{ relativePath: 'src/app.ts', dependentCount: 5 }],
      unreferencedFiles: [],
      isPartial: false
    },
    duplication: {
      findings: [],
      duplicatedLines: 0,
      duplicationPercentage: 20,
      isPartial: false
    },
    classifications: [classification('src/app.ts', ['routing', 'validation', 'data_access'])],
    patternFindings: [
      {
        concern: 'data_access',
        dominantPattern: 'repository',
        patternCount: 3,
        deviations: [{ location: 'src/app.ts', pattern: 'inline', expectedPattern: 'repository' }],
        confidence: 'low',
        reason: '3 patterns detected'
      }
    ]
  };
}
