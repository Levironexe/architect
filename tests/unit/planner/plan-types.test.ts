import { describe, expect, it } from 'vitest';

import type { AIAgentPrompt, PlanOutputFormat, RefactorPlan } from '../../../src/types/plan';
import { createPlanFixture } from './plan-fixtures';

describe('plan types', () => {
  it('supports the expected plan model shape', () => {
    const plan: RefactorPlan = createPlanFixture();
    const format: PlanOutputFormat = 'json';
    const prompt: AIAgentPrompt = {
      projectContext: 'context',
      skillBlueprint: 'blueprint',
      plan: 'plan',
      constraints: ['preserve behavior'],
      budgetStatus: 'within_budget'
    };

    expect(plan.phases[0]?.steps[0]?.importsToUpdate).toEqual([]);
    expect(format).toBe('json');
    expect(prompt.constraints).toContain('preserve behavior');
  });
});
