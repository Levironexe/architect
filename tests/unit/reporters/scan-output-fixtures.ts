import type { ScanResult } from '../../../src/types/analysis';
import type { ScanDiagnostic, ScanWarning } from '../../../src/types/scan-output';

export function scanResultFixture(): ScanResult {
  return {
    summary: {
      targetDir: '/tmp/project',
      totalFiles: 1,
      skippedFiles: 0,
      totalLoc: 10,
      totalLines: 12,
      flaggedFiles: 0,
      flaggedFunctions: 0,
      dependencyHotspots: 0,
      circularDependencies: 0,
      duplicateFindings: 0,
      duplicatedLines: 0,
      scanDurationMs: 12
    },
    files: [
      {
        path: '/tmp/project/index.ts',
        relativePath: 'index.ts',
        loc: 10,
        blankLines: 1,
        commentLines: 1,
        totalLines: 12,
        functions: [],
        classes: [],
        imports: [],
        exports: [],
        isOversized: false,
        hasCriticalComplexity: false,
        parseError: null
      }
    ],
    parseErrors: [],
    dependencyGraph: {
      nodes: [],
      circularDependencies: [],
      hotspots: [],
      unreferencedFiles: [],
      isPartial: false
    },
    duplication: {
      findings: [],
      duplicatedLines: 0,
      duplicationPercentage: 0,
      isPartial: false
    },
    warnings: [],
    diagnostics: []
  };
}

export const warningFixture: ScanWarning = {
  code: 'parse_error',
  path: 'broken.ts',
  message: 'Failed to parse broken.ts: Unexpected token'
};

export const diagnosticFixture: ScanDiagnostic = {
  phase: 'classification',
  message: 'No AI provider configured',
  details: { mode: 'skipped' }
};
