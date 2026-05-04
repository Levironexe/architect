import { describe, expect, it } from 'vitest';

import { renderPlanPrompt } from '../../../src/formatters/plan-prompt';
import { createPlanFixture, createScanFixture, createSkillMatch } from '../planner/plan-fixtures';

describe('renderPlanPrompt', () => {
  it('renders project context, ordered steps, skill rules, constraints, and validation findings context', () => {
    const output = renderPlanPrompt(createPlanFixture(), createScanFixture(), createSkillMatch());

    expect(output).toContain('PROJECT CONTEXT');
    expect(output).toContain('ORDERED PLAN');
    expect(output).toContain('ARCHITECTURE BLUEPRINT');
    expect(output).toContain('Express.js REST API');
    expect(output).toContain('Preserve existing behavior');
  });

  it('states when no confident primary skill is available', () => {
    const output = renderPlanPrompt(createPlanFixture(), createScanFixture({ matchedSkills: [] }), null);

    expect(output).toContain('No confident primary architecture skill was detected');
  });
});
