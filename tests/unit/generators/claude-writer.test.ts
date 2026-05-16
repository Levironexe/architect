import { describe, expect, it } from 'vitest';

import { buildClaudeWriterTargets } from '../../../src/generators/claudeWriter';

describe('buildClaudeWriterTargets', () => {
  it('maps rendered files to Claude skill destinations', () => {
    const targets = buildClaudeWriterTargets([
      { name: 'architect-plan', content: 'plan content' },
      { name: 'architect-refactor', content: 'refactor content' }
    ]);

    expect(targets).toEqual([
      {
        name: 'architect-plan',
        relativePath: '.claude/skills/architect-plan/SKILL.md',
        content: 'plan content',
        mode: 'replace'
      },
      {
        name: 'architect-refactor',
        relativePath: '.claude/skills/architect-refactor/SKILL.md',
        content: 'refactor content',
        mode: 'replace'
      }
    ]);
  });
});