import { describe, expect, it } from 'vitest';

import { renderScanReport } from '../../../src/reporters/terminal';
import { captureOutput } from '../test-helpers';

describe('renderScanReport', () => {
  it('prints metrics and summary information to stdout and parse warnings to stderr', async () => {
    const output = await captureOutput(() => {
      renderScanReport(
        {
          summary: {
            targetDir: '/tmp/project',
            totalFiles: 1,
            skippedFiles: 1,
            totalLoc: 321,
            totalLines: 330,
            flaggedFiles: 1,
            flaggedFunctions: 1,
            scanDurationMs: 12
          },
          files: [
            {
              path: '/tmp/project/server.ts',
              relativePath: 'server.ts',
              loc: 321,
              blankLines: 4,
              commentLines: 5,
              totalLines: 330,
              functions: [
                {
                  name: 'calculateLegacyHealth',
                  paramCount: 3,
                  startLine: 12,
                  endLine: 42,
                  loc: 25,
                  complexity: 19,
                  isFlagged: true
                }
              ],
              classes: [],
              imports: [
                {
                  source: 'express',
                  isRelative: false,
                  isBuiltin: false,
                  specifiers: ['express']
                }
              ],
              exports: [
                {
                  name: 'default',
                  kind: 'default'
                }
              ],
              isOversized: true,
              hasCriticalComplexity: true,
              parseError: null
            }
          ],
          parseErrors: [
            {
              path: '/tmp/project/broken.ts',
              relativePath: 'broken.ts',
              error: 'Unexpected token'
            }
          ]
        },
        { color: false }
      );
    });

    expect(output.stdout).toContain('FILE');
    expect(output.stdout).toContain('server.ts');
    expect(output.stdout).toContain('OVERSIZED');
    expect(output.stdout).toContain('Critical functions');
    expect(output.stdout).toContain('Summary');
    expect(output.stdout).toContain('- Flagged functions: 1');
    expect(output.stderr).toContain('WARN  Failed to parse broken.ts: Unexpected token');
    expect(output.stdout).not.toContain('\u001b[');
  });

  it('reports healthy scans without critical findings', async () => {
    const output = await captureOutput(() => {
      renderScanReport(
        {
          summary: {
            targetDir: '/tmp/project',
            totalFiles: 1,
            skippedFiles: 0,
            totalLoc: 12,
            totalLines: 14,
            flaggedFiles: 0,
            flaggedFunctions: 0,
            scanDurationMs: 5
          },
          files: [
            {
              path: '/tmp/project/clean.ts',
              relativePath: 'clean.ts',
              loc: 12,
              blankLines: 1,
              commentLines: 1,
              totalLines: 14,
              functions: [],
              classes: [],
              imports: [],
              exports: [],
              isOversized: false,
              hasCriticalComplexity: false,
              parseError: null
            }
          ],
          parseErrors: []
        },
        { color: false }
      );
    });

    expect(output.stdout).toContain('OK');
    expect(output.stdout).toContain('- Flagged functions: 0');
    expect(output.stdout).toContain('- No critical findings detected');
    expect(output.stderr).toBe('');
  });

  it('prints dependency and duplication sections with partial-analysis warnings', async () => {
    const output = await captureOutput(() => {
      renderScanReport(
        {
          summary: {
            targetDir: '/tmp/project',
            totalFiles: 2,
            skippedFiles: 1,
            totalLoc: 64,
            totalLines: 70,
            flaggedFiles: 0,
            flaggedFunctions: 0,
            dependencyHotspots: 1,
            circularDependencies: 1,
            duplicateFindings: 1,
            duplicatedLines: 18,
            scanDurationMs: 20
          },
          files: [
            {
              path: '/tmp/project/src/a.ts',
              relativePath: 'src/a.ts',
              loc: 32,
              blankLines: 2,
              commentLines: 1,
              totalLines: 35,
              functions: [],
              classes: [],
              imports: [],
              exports: [],
              isOversized: false,
              hasCriticalComplexity: false,
              parseError: null
            },
            {
              path: '/tmp/project/src/b.ts',
              relativePath: 'src/b.ts',
              loc: 32,
              blankLines: 2,
              commentLines: 1,
              totalLines: 35,
              functions: [],
              classes: [],
              imports: [],
              exports: [],
              isOversized: false,
              hasCriticalComplexity: false,
              parseError: null
            }
          ],
          parseErrors: [
            {
              path: '/tmp/project/broken.ts',
              relativePath: 'broken.ts',
              error: 'Unexpected token'
            }
          ],
          dependencyGraph: {
            nodes: [],
            hotspots: [{ relativePath: 'src/shared/format.ts', dependentCount: 3 }],
            circularDependencies: [{ files: ['src/a.ts', 'src/b.ts', 'src/a.ts'] }],
            unreferencedFiles: ['src/unused.ts'],
            isPartial: true
          },
          duplication: {
            findings: [
              {
                occurrences: [
                  { relativePath: 'src/a.ts', startLine: 10, endLine: 27 },
                  { relativePath: 'src/b.ts', startLine: 12, endLine: 29 }
                ],
                duplicatedLines: 18,
                similarity: null
              }
            ],
            duplicatedLines: 18,
            duplicationPercentage: 28.1,
            isPartial: true
          }
        },
        { color: false }
      );
    });

    expect(output.stdout).toContain('Dependency insights');
    expect(output.stdout).toContain('Hotspot: src/shared/format.ts (depended on by 3 files)');
    expect(output.stdout).toContain('Circular dependency: src/a.ts -> src/b.ts -> src/a.ts');
    expect(output.stdout).toContain('Duplication findings');
    expect(output.stdout).toContain('Duplicate block (18 lines): src/a.ts:10-27 <-> src/b.ts:12-29');
    expect(output.stdout).toContain('- Dependency hotspots: 1');
    expect(output.stdout).toContain('- Duplicate findings: 1');
    expect(output.stderr).toContain('Dependency and duplication findings may be partial because 1 file was skipped');
  });

  it('prints structure comparison output when available', async () => {
    const output = await captureOutput(() => {
      renderScanReport(
        {
          summary: {
            targetDir: '/tmp/project',
            totalFiles: 1,
            skippedFiles: 0,
            totalLoc: 1,
            totalLines: 1,
            flaggedFiles: 0,
            flaggedFunctions: 0,
            dependencyHotspots: 0,
            circularDependencies: 0,
            duplicateFindings: 0,
            duplicatedLines: 0,
            scanDurationMs: 1
          },
          files: [
            {
              path: '/tmp/project/index.ts',
              relativePath: 'index.ts',
              loc: 1,
              blankLines: 0,
              commentLines: 0,
              totalLines: 1,
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
            hotspots: [],
            circularDependencies: [],
            unreferencedFiles: [],
            isPartial: false
          },
          duplication: {
            findings: [],
            duplicatedLines: 0,
            duplicationPercentage: 0,
            isPartial: false
          },
          matchedSkills: [],
          structureComparison: {
            skillId: 'express-api',
            isAvailable: true,
            entries: [
              { path: 'src/routes', purpose: 'Route definitions', required: true, status: 'present' },
              { path: 'src/controllers', purpose: 'Request handlers', required: true, status: 'missing' }
            ]
          }
        },
        { color: false }
      );
    });

    expect(output.stdout).toContain('Structure comparison');
    expect(output.stdout).toContain('present  src/routes');
    expect(output.stdout).toContain('missing  src/controllers');
  });

  it('prints skill-aware sections in contract order without ANSI codes when color is disabled', async () => {
    const output = await captureOutput(() => {
      renderScanReport(
        {
          summary: {
            targetDir: '/tmp/project',
            totalFiles: 1,
            skippedFiles: 0,
            totalLoc: 8,
            totalLines: 9,
            flaggedFiles: 0,
            flaggedFunctions: 0,
            dependencyHotspots: 0,
            circularDependencies: 0,
            duplicateFindings: 0,
            duplicatedLines: 0,
            scanDurationMs: 1
          },
          files: [
            {
              path: '/tmp/project/index.ts',
              relativePath: 'index.ts',
              loc: 8,
              blankLines: 1,
              commentLines: 0,
              totalLines: 9,
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
            hotspots: [],
            circularDependencies: [],
            unreferencedFiles: [],
            isPartial: false
          },
          duplication: {
            findings: [],
            duplicatedLines: 0,
            duplicationPercentage: 0,
            isPartial: false
          },
          matchedSkills: [],
          structureComparison: {
            skillId: '',
            entries: [],
            isAvailable: false
          },
          scores: {
            modularity: { score: 100, weight: 25, label: 'healthy', reasons: [] },
            duplication: { score: 100, weight: 20, label: 'healthy', reasons: [] },
            partialHealthScore: 100,
            availableWeight: 45
          }
        },
        { color: false }
      );
    });

    expect(output.stdout).toContain('Project overview');
    expect(output.stdout).toContain('Languages: TypeScript');
    expect(output.stdout.indexOf('Project overview')).toBeLessThan(output.stdout.indexOf('Detected architecture'));
    expect(output.stdout.indexOf('Detected architecture')).toBeLessThan(output.stdout.indexOf('Structure comparison'));
    expect(output.stdout.indexOf('Structure comparison')).toBeLessThan(output.stdout.indexOf('Concern classification'));
    expect(output.stdout.indexOf('Concern classification')).toBeLessThan(output.stdout.indexOf('Pattern consistency'));
    expect(output.stdout.indexOf('Pattern consistency')).toBeLessThan(output.stdout.indexOf('Dependency insights'));
    expect(output.stdout.indexOf('Duplication findings')).toBeLessThan(output.stdout.indexOf('Health report'));
    expect(output.stdout).toContain('Unavailable because no primary architecture skill was detected');
    expect(output.stdout).not.toContain('\u001b[');
  });

  it('prints pattern consistency findings', async () => {
    const output = await captureOutput(() => {
      renderScanReport(
        {
          summary: {
            targetDir: '/tmp/project',
            totalFiles: 1,
            skippedFiles: 0,
            totalLoc: 1,
            totalLines: 1,
            flaggedFiles: 0,
            flaggedFunctions: 0,
            dependencyHotspots: 0,
            circularDependencies: 0,
            duplicateFindings: 0,
            duplicatedLines: 0,
            scanDurationMs: 1
          },
          files: [
            {
              path: '/tmp/project/index.ts',
              relativePath: 'index.ts',
              loc: 1,
              blankLines: 0,
              commentLines: 0,
              totalLines: 1,
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
          patternFindings: [
            {
              concern: 'data_access',
              dominantPattern: 'repository',
              patternCount: 2,
              deviations: [{ location: 'src/a.ts', pattern: 'inline', expectedPattern: 'repository' }],
              confidence: 'medium',
              reason: '2 patterns detected'
            },
            {
              concern: 'validation',
              dominantPattern: null,
              patternCount: 0,
              deviations: [],
              confidence: 'insufficient',
              reason: 'Insufficient evidence'
            }
          ]
        },
        { color: false }
      );
    });

    expect(output.stdout).toContain('Pattern consistency');
    expect(output.stdout).toContain('data_access: 2 pattern(s), dominant repository, 1 deviation(s)');
    expect(output.stdout).toContain('validation: insufficient evidence');
  });

  it('prints health score and dimension breakdown', async () => {
    const output = await captureOutput(() => {
      renderScanReport(
        {
          summary: {
            targetDir: '/tmp/project',
            totalFiles: 1,
            skippedFiles: 0,
            totalLoc: 1,
            totalLines: 1,
            flaggedFiles: 0,
            flaggedFunctions: 0,
            dependencyHotspots: 0,
            circularDependencies: 0,
            duplicateFindings: 0,
            duplicatedLines: 0,
            scanDurationMs: 1
          },
          files: [
            {
              path: '/tmp/project/index.ts',
              relativePath: 'index.ts',
              loc: 1,
              blankLines: 0,
              commentLines: 0,
              totalLines: 1,
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
          health: {
            score: 78,
            label: 'warning',
            state: 'partial',
            availableWeight: 45,
            totalWeight: 100,
            reasons: ['separation unavailable']
          },
          dimensions: {
            separation: { id: 'separation', score: null, weight: 30, label: 'unavailable', state: 'unavailable', reasons: ['classification unavailable'] },
            consistency: { id: 'consistency', score: null, weight: 25, label: 'unavailable', state: 'unavailable', reasons: ['patterns unavailable'] },
            modularity: { id: 'modularity', score: 60, weight: 25, label: 'warning', state: 'available', reasons: ['large file'] },
            duplication: { id: 'duplication', score: 100, weight: 20, label: 'healthy', state: 'available', reasons: ['0% duplication'] }
          }
        },
        { color: false }
      );
    });

    expect(output.stdout).toContain('Health report');
    expect(output.stdout).toContain('Overall score: 78 warning (partial)');
    expect(output.stdout).toContain('separation: unavailable unavailable');
    expect(output.stdout).toContain('modularity: 60 warning');
  });

  it('prints skipped concern classification status', async () => {
    const output = await captureOutput(() => {
      renderScanReport(
        {
          summary: {
            targetDir: '/tmp/project',
            totalFiles: 1,
            skippedFiles: 0,
            totalLoc: 1,
            totalLines: 1,
            flaggedFiles: 0,
            flaggedFunctions: 0,
            dependencyHotspots: 0,
            circularDependencies: 0,
            duplicateFindings: 0,
            duplicatedLines: 0,
            scanDurationMs: 1
          },
          files: [
            {
              path: '/tmp/project/index.ts',
              relativePath: 'index.ts',
              loc: 1,
              blankLines: 0,
              commentLines: 0,
              totalLines: 1,
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
          classificationStatus: {
            mode: 'skipped',
            reason: 'No AI provider configured.',
            warnings: []
          }
        },
        { color: false }
      );
    });

    expect(output.stdout).toContain('Concern classification');
    expect(output.stdout).toContain('Skipped: No AI provider configured.');
  });

  it('prints completed concern classification without leaking secret-looking warnings', async () => {
    const output = await captureOutput(() => {
      renderScanReport(
        {
          summary: {
            targetDir: '/tmp/project',
            totalFiles: 1,
            skippedFiles: 0,
            totalLoc: 1,
            totalLines: 1,
            flaggedFiles: 0,
            flaggedFunctions: 0,
            dependencyHotspots: 0,
            circularDependencies: 0,
            duplicateFindings: 0,
            duplicatedLines: 0,
            scanDurationMs: 1
          },
          files: [
            {
              path: '/tmp/project/index.ts',
              relativePath: 'index.ts',
              loc: 1,
              blankLines: 0,
              commentLines: 0,
              totalLines: 1,
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
          classifications: [
            {
              file: 'index.ts',
              dominantConcern: 'routing',
              mixedConcerns: false,
              warnings: [],
              functions: [
                {
                  name: 'routeUser',
                  concern: 'routing',
                  confidence: 0.9,
                  isMisplaced: true,
                  reason: 'belongs in src/routes'
                }
              ]
            }
          ],
          classificationStatus: {
            mode: 'completed',
            provider: 'mock',
            warnings: ['api_key=[redacted]']
          }
        },
        { color: false }
      );
    });

    expect(output.stdout).toContain('Completed via mock');
    expect(output.stdout).toContain('routeUser (routing)');
    expect(output.stderr).toContain('[redacted]');
    expect(output.stderr).not.toContain('sk-secret');
  });

  it('prints ranked issues and roadmap guidance', async () => {
    const output = await captureOutput(() => {
      renderScanReport(
        {
          summary: {
            targetDir: '/tmp/project',
            totalFiles: 1,
            skippedFiles: 0,
            totalLoc: 1,
            totalLines: 1,
            flaggedFiles: 0,
            flaggedFunctions: 0,
            dependencyHotspots: 0,
            circularDependencies: 0,
            duplicateFindings: 0,
            duplicatedLines: 0,
            scanDurationMs: 1
          },
          files: [
            {
              path: '/tmp/project/index.ts',
              relativePath: 'index.ts',
              loc: 1,
              blankLines: 0,
              commentLines: 0,
              totalLines: 1,
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
          issues: [
            {
              severity: 'critical',
              category: 'separation',
              location: 'src/app.ts',
              message: 'src/app.ts mixes concerns.',
              suggestion: 'Split the file.'
            },
            {
              severity: 'warning',
              category: 'complexity',
              location: 'src/app.ts :: run',
              message: 'run is complex.',
              suggestion: 'Simplify branching.'
            }
          ],
          guidance: {
            message: 'Critical structural issues found.',
            command: 'architect plan'
          }
        },
        { color: false }
      );
    });

    expect(output.stdout).toContain('Ranked issues');
    expect(output.stdout.indexOf('CRITICAL')).toBeLessThan(output.stdout.indexOf('WARNING'));
    expect(output.stdout).toContain('Next step');
    expect(output.stdout).toContain('architect plan');
  });
});
