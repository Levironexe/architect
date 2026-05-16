import { describe, expect, it } from 'vitest';

import { buildIssues, createReportGuidance } from '../../../src/scoring/issue-builder';
import type { ScanResult } from '../../../src/types/analysis';

describe('issue builder', () => {
  it('sorts critical issues before warnings', () => {
    const issues = buildIssues(createResult());

    expect(issues[0]?.severity).toBe('critical');
    expect(issues.every((issue) => issue.suggestion.length > 0)).toBe(true);
  });

  it('flags oversized files as critical modularity issues', () => {
    const issues = buildIssues(createResult());
    const oversizedIssue = issues.find((issue) => issue.category === 'modularity');

    expect(oversizedIssue).toBeDefined();
    expect(oversizedIssue?.severity).toBe('critical');
  });

  it('flags high-complexity functions as warnings', () => {
    const issues = buildIssues(createResult());
    const complexityIssue = issues.find((issue) => issue.category === 'complexity');

    expect(complexityIssue).toBeDefined();
    expect(complexityIssue?.severity).toBe('warning');
  });

  it('flags high duplication as an issue', () => {
    const result = createResult();
    result.duplication.duplicationPercentage = 20;

    const issues = buildIssues(result);
    const dupIssue = issues.find((issue) => issue.category === 'duplication');

    expect(dupIssue).toBeDefined();
  });

  it('does not create separation or consistency issues (no LLM)', () => {
    const issues = buildIssues(createResult());

    expect(issues.find((issue) => issue.category === 'separation')).toBeUndefined();
    expect(issues.find((issue) => issue.category === 'consistency')).toBeUndefined();
  });

  it('does not create false critical issues for clean results', () => {
    const clean = createResult();
    clean.files[0] = { ...clean.files[0]!, isOversized: false, loc: 20, functions: [] };
    clean.duplication.duplicationPercentage = 0;
    clean.dependencyGraph.hotspots = [];

    expect(buildIssues(clean).filter((issue) => issue.severity === 'critical')).toEqual([]);
  });

  it('creates guidance without a plan command reference', () => {
    const result = createResult();
    result.issues = buildIssues(result);
    const guidance = createReportGuidance(result);

    expect(guidance.message).toContain('Critical');
    expect(guidance.command).toBeUndefined();
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
    }
  };
}
