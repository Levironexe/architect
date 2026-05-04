import type { ScanResult } from '../../../src/types/analysis';
import type { ReportIssue } from '../../../src/types/issue';
import type { RefactorPlan } from '../../../src/types/plan';
import type { ArchitectureSkill, SkillMatch } from '../../../src/types/skill';

export function createScanFixture(overrides: Partial<ScanResult> = {}): ScanResult {
  const base: ScanResult = {
    summary: {
      targetDir: '/tmp/project',
      totalFiles: 2,
      skippedFiles: 0,
      totalLoc: 380,
      totalLines: 420,
      flaggedFiles: 1,
      flaggedFunctions: 1,
      dependencyHotspots: 1,
      circularDependencies: 0,
      duplicateFindings: 1,
      duplicatedLines: 18,
      scanDurationMs: 20
    },
    files: [
      {
        path: '/tmp/project/server.ts',
        relativePath: 'server.ts',
        loc: 340,
        blankLines: 20,
        commentLines: 10,
        totalLines: 370,
        functions: [
          {
            name: 'handleEverything',
            paramCount: 3,
            startLine: 20,
            endLine: 120,
            loc: 101,
            complexity: 22,
            isFlagged: true
          }
        ],
        classes: [],
        imports: [],
        exports: [],
        isOversized: true,
        hasCriticalComplexity: true,
        parseError: null
      },
      {
        path: '/tmp/project/src/shared/format.ts',
        relativePath: 'src/shared/format.ts',
        loc: 40,
        blankLines: 4,
        commentLines: 2,
        totalLines: 46,
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
      nodes: [
        {
          path: '/tmp/project/server.ts',
          relativePath: 'server.ts',
          imports: [],
          importedBy: ['src/index.ts']
        },
        {
          path: '/tmp/project/src/shared/format.ts',
          relativePath: 'src/shared/format.ts',
          imports: [],
          importedBy: ['server.ts', 'src/index.ts', 'src/report.ts']
        }
      ],
      circularDependencies: [],
      hotspots: [{ relativePath: 'src/shared/format.ts', dependentCount: 3 }],
      unreferencedFiles: [],
      isPartial: false
    },
    duplication: {
      findings: [
        {
          occurrences: [
            { relativePath: 'server.ts', startLine: 140, endLine: 158 },
            { relativePath: 'src/shared/format.ts', startLine: 10, endLine: 28 }
          ],
          duplicatedLines: 18,
          similarity: null
        }
      ],
      duplicatedLines: 18,
      duplicationPercentage: 9,
      isPartial: false
    },
    matchedSkills: [createSkillMatch()],
    structureComparison: {
      skillId: 'express-api',
      isAvailable: true,
      entries: [
        { path: 'src/routes', purpose: 'HTTP route definitions', required: true, status: 'missing' },
        { path: 'src/controllers', purpose: 'Request handlers', required: true, status: 'missing' }
      ]
    },
    health: {
      score: 62,
      label: 'warning',
      state: 'partial',
      availableWeight: 45,
      totalWeight: 100,
      reasons: ['partial']
    },
    issues: [
      issue('critical', 'modularity', 'server.ts', 'server.ts is oversized', 'Extract route handlers'),
      issue('warning', 'duplication', 'server.ts', 'Duplicate logic found', 'Consolidate duplicate block')
    ],
    classifications: [
      {
        file: 'server.ts',
        dominantConcern: 'routing',
        mixedConcerns: true,
        warnings: [],
        functions: [
          {
            name: 'findUserById',
            concern: 'data_access',
            confidence: 0.9,
            isMisplaced: true,
            reason: 'Data access belongs in a repository'
          }
        ]
      }
    ]
  };

  return { ...base, ...overrides };
}

export function createCleanScanFixture(): ScanResult {
  return createScanFixture({
    summary: {
      targetDir: '/tmp/clean',
      totalFiles: 1,
      skippedFiles: 0,
      totalLoc: 20,
      totalLines: 24,
      flaggedFiles: 0,
      flaggedFunctions: 0,
      dependencyHotspots: 0,
      circularDependencies: 0,
      duplicateFindings: 0,
      duplicatedLines: 0,
      scanDurationMs: 5
    },
    files: [
      {
        path: '/tmp/clean/index.ts',
        relativePath: 'index.ts',
        loc: 20,
        blankLines: 2,
        commentLines: 1,
        totalLines: 24,
        functions: [],
        classes: [],
        imports: [],
        exports: [],
        isOversized: false,
        hasCriticalComplexity: false,
        parseError: null
      }
    ],
    dependencyGraph: { nodes: [], circularDependencies: [], hotspots: [], unreferencedFiles: [], isPartial: false },
    duplication: { findings: [], duplicatedLines: 0, duplicationPercentage: 0, isPartial: false },
    matchedSkills: [],
    structureComparison: null,
    issues: [],
    classifications: []
  });
}

export function createPlanFixture(): RefactorPlan {
  return {
    summary: 'Refactor fixture project through 2 ordered steps.',
    estimatedComplexity: 'medium',
    estimatedRisk: 'medium',
    source: {
      targetDir: '/tmp/project',
      primarySkillId: 'express-api',
      healthLabel: 'warning',
      issueCount: 2
    },
    assumptions: ['Plan is generated from the current scan result and does not modify source files.'],
    validationFindings: [],
    phases: [
      {
        name: 'Prepare target structure',
        description: 'Create missing destinations.',
        steps: [
          {
            stepNumber: 1,
            action: 'create_dir',
            sourceFile: null,
            targetFile: 'src/routes',
            what: 'Create route directory.',
            why: 'Routes need a clear home.',
            lineRange: null,
            importsToUpdate: [],
            dependencyNotes: 'None until code is moved into the new directory.',
            risk: 'low',
            confidence: 'high'
          }
        ]
      },
      {
        name: 'Reduce structural hotspots',
        description: 'Extract risky code.',
        steps: [
          {
            stepNumber: 2,
            action: 'extract',
            sourceFile: 'server.ts',
            targetFile: 'src/controllers',
            what: 'Extract handleEverything from server.ts.',
            why: 'server.ts is oversized.',
            lineRange: '20-120',
            importsToUpdate: ['src/index.ts'],
            dependencyNotes: 'Update imports in src/index.ts.',
            risk: 'medium',
            confidence: 'high'
          }
        ]
      }
    ]
  };
}

export function createSkillMatch(): SkillMatch {
  const skill: ArchitectureSkill = {
    schemaVersion: '1.0.0',
    id: 'express-api',
    name: 'Express.js REST API',
    version: '1.0.0',
    description: 'Express API structure',
    category: 'stack',
    language: 'typescript',
    frameworks: ['express'],
    detection: {},
    structure: {
      requiredDirs: [{ path: 'src/routes', purpose: 'HTTP routes' }],
      recommendedDirs: [{ path: 'src/services', purpose: 'Business logic' }]
    },
    separation: {
      rules: [{ concern: 'routing', belongsIn: 'src/routes' }]
    },
    patterns: {
      naming: { routes: '*.routes.ts' },
      dataFlow: {
        direction: 'routes -> services -> repositories',
        rules: ['Routes call services']
      }
    },
    antiPatterns: [{ id: 'god-server', severity: 'critical', description: 'Avoid one large server file.' }]
  };

  return {
    skill,
    confidence: 'high',
    score: 90,
    reasons: ['express dependency'],
    primary: true
  };
}

function issue(severity: ReportIssue['severity'], category: string, location: string, message: string, suggestion: string): ReportIssue {
  return { severity, category, location, message, suggestion };
}
