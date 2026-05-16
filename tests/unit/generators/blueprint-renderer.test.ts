import { describe, expect, it } from 'vitest';

import { renderBlueprint } from '../../../src/generators/blueprint-renderer';
import type { ArchitectureSkill } from '../../../src/types/skill';

const skill: ArchitectureSkill = {
  schemaVersion: '2.0.0',
  id: 'express-api',
  name: 'Express.js REST API',
  version: '1.0.0',
  description: 'Layered Express API',
  category: 'stack',
  language: 'javascript',
  frameworks: ['express'],
  detection: {},
  structure: {
    requiredDirs: [{ path: 'src/routes', purpose: 'Route definitions.' }],
    recommendedDirs: [{ path: 'src/utils', purpose: 'Shared utilities.' }]
  },
  separation: {
    rules: [
      {
        concern: 'routing',
        belongsIn: 'src/routes',
        ruleText: 'Routes own endpoint definitions.',
        example: "router.get('/users', controller.list);"
      }
    ]
  },
  patterns: {
    dataFlow: {
      direction: 'Route -> Controller -> Service -> Model',
      rules: ['Routes call controllers.']
    }
  },
  antiPatterns: [
    {
      id: 'god_file',
      severity: 'critical',
      description: 'One file mixes all concerns.',
      badExample: 'app.post(...)',
      goodExample: 'router.post(...)'
    }
  ]
};

describe('renderBlueprint', () => {
  it('renders structure, rules, and anti-patterns in readable sections', () => {
    const output = renderBlueprint(skill);

    expect(output).toContain('# Express.js REST API (express-api)');
    expect(output).toContain('## Structure');
    expect(output).toContain('- src/routes: Route definitions.');
    expect(output).toContain('## Separation Rules');
    expect(output).toContain('Routes own endpoint definitions.');
    expect(output).toContain('## Anti-Patterns');
    expect(output).toContain('One file mixes all concerns.');
  });
});