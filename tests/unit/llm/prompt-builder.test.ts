import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { buildClassificationPrompt, createClassificationRequest } from '../../../src/llm/prompt-builder';
import type { FileAnalysis } from '../../../src/types/analysis';
import type { SkillMatch } from '../../../src/types/skill';

describe('prompt builder', () => {
  it('includes skill separation rules, imports, and function summaries', () => {
    const request = createClassificationRequest({
      projectRoot: '/tmp/project',
      files: [createFileAnalysis()],
      matchedSkills: [createSkillMatch()],
      tokenBudget: 2000
    });

    const prompt = buildClassificationPrompt(request);

    expect(prompt).toContain('Express.js REST API');
    expect(prompt).toContain('routing');
    expect(prompt).toContain('src/routes');
    expect(prompt).toContain('getUserRoute');
    expect(prompt).toContain('express');
  });

  it('excludes full source, function bodies, secrets, and absolute project paths', () => {
    const request = createClassificationRequest({
      projectRoot: '/tmp/project',
      files: [
        {
          ...createFileAnalysis(),
          path: '/tmp/project/src/server.ts',
          relativePath: '/tmp/project/src/server.ts',
          imports: [
            {
              source: 'sk-secret123',
              specifiers: ['anthropic-secret456'],
              isBuiltin: false,
              isRelative: false
            }
          ]
        }
      ],
      matchedSkills: [createSkillMatch()],
      tokenBudget: 2000
    });

    const prompt = buildClassificationPrompt(request);

    expect(prompt).not.toContain('return dangerousBody');
    expect(prompt).not.toContain('sk-secret123');
    expect(prompt).not.toContain('anthropic-secret456');
    expect(prompt).not.toContain('/tmp/project');
    expect(prompt).toContain('src/server.ts');
  });

  it('trims large inputs to the configured prompt budget', () => {
    const files = Array.from({ length: 40 }, (_, index) => ({
      ...createFileAnalysis(),
      path: `/tmp/project/src/file-${index}.ts`,
      relativePath: `src/file-${index}.ts`
    }));

    const request = createClassificationRequest({
      projectRoot: '/tmp/project',
      files,
      matchedSkills: [createSkillMatch()],
      tokenBudget: 100
    });

    const prompt = buildClassificationPrompt(request);

    expect(prompt.length).toBeLessThanOrEqual(1600);
    expect(prompt).toContain('separationRules');
  });
});

function createFileAnalysis(): FileAnalysis {
  return {
    path: path.resolve('/tmp/project/src/server.ts'),
    relativePath: 'src/server.ts',
    loc: 20,
    blankLines: 1,
    commentLines: 0,
    totalLines: 21,
    functions: [
      {
        name: 'getUserRoute',
        paramCount: 2,
        startLine: 3,
        endLine: 8,
        loc: 6,
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
    score: 5,
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
      separation: {
        rules: [{ concern: 'routing', belongsIn: 'src/routes', indicators: ['router.get'] }]
      },
      patterns: {},
      antiPatterns: []
    }
  };
}
