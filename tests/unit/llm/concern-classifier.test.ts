import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { classifyConcerns } from '../../../src/llm/concern-classifier';
import type { FileAnalysis } from '../../../src/types/analysis';
import type { SkillMatch } from '../../../src/types/skill';
import { MockProvider } from './mock-provider';

describe('classifyConcerns', () => {
  it('skips classification when no provider is configured', async () => {
    const result = await classifyConcerns({
      projectRoot: '/tmp/project',
      files: [createFileAnalysis()],
      matchedSkills: [],
      env: {}
    });

    expect(result.status.mode).toBe('skipped');
    expect(result.classifications).toEqual([]);
  });

  it('classifies functions with a mock provider', async () => {
    const provider = new MockProvider(
      JSON.stringify({
        files: [
          {
            file: 'src/app.ts',
            functions: [
              { name: 'routeUser', concern: 'routing', confidence: 0.9, isMisplaced: true, reason: 'Route handler in app file' }
            ]
          }
        ]
      })
    );

    const result = await classifyConcerns({
      projectRoot: '/tmp/project',
      files: [createFileAnalysis()],
      matchedSkills: [createSkillMatch()],
      provider
    });

    expect(result.status.mode).toBe('completed');
    expect(result.status.provider).toBe('mock');
    expect(result.classifications[0]?.functions[0]?.concern).toBe('routing');
    expect(result.classifications[0]?.functions[0]?.isMisplaced).toBe(true);
    expect(provider.prompts[0]).toContain('separationRules');
  });

  it('fails gracefully when the provider throws', async () => {
    const provider = new MockProvider(() => {
      throw new Error('rate limit');
    });

    const result = await classifyConcerns({
      projectRoot: '/tmp/project',
      files: [createFileAnalysis()],
      matchedSkills: [createSkillMatch()],
      provider
    });

    expect(result.status.mode).toBe('failed');
    expect(result.status.reason).toContain('rate limit');
  });
});

function createFileAnalysis(): FileAnalysis {
  return {
    path: path.resolve('/tmp/project/src/app.ts'),
    relativePath: 'src/app.ts',
    loc: 8,
    blankLines: 0,
    commentLines: 0,
    totalLines: 8,
    functions: [
      {
        name: 'routeUser',
        paramCount: 2,
        startLine: 1,
        endLine: 5,
        loc: 5,
        complexity: 1,
        isFlagged: false
      }
    ],
    classes: [],
    imports: [{ source: 'express', isRelative: false, isBuiltin: false, specifiers: ['express'] }],
    exports: [],
    isOversized: false,
    hasCriticalComplexity: false,
    parseError: null
  };
}

function createSkillMatch(): SkillMatch {
  return {
    confidence: 'high',
    primary: true,
    score: 3,
    reasons: [],
    skill: {
      schemaVersion: '1.0.0',
      id: 'express-api',
      name: 'Express.js REST API',
      version: '1.0.0',
      description: 'Express API',
      category: 'stack',
      language: 'typescript',
      frameworks: ['express'],
      detection: {},
      structure: { requiredDirs: [], recommendedDirs: [] },
      separation: { rules: [{ concern: 'routing', belongsIn: 'src/routes' }] },
      patterns: {},
      antiPatterns: []
    }
  };
}
