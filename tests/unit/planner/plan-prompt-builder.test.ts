import { describe, expect, it } from 'vitest';

import { buildAIAgentPrompt, estimateTokens, serializePrompt } from '../../../src/planner/plan-prompt-builder';
import { createPlanFixture, createScanFixture, createSkillMatch } from './plan-fixtures';

describe('buildAIAgentPrompt', () => {
  it('includes matched skill blueprint and safety constraints', () => {
    const prompt = buildAIAgentPrompt(createPlanFixture(), createScanFixture(), createSkillMatch());
    const text = serializePrompt(prompt);

    expect(text).toContain('Target structure');
    expect(text).toContain('Separation rules');
    expect(text).toContain('Naming conventions');
    expect(text).toContain('Pattern expectations');
    expect(text).toContain('Anti-patterns');
    expect(text).toContain('Preserve existing behavior');
  });

  it('trims large prompts to the configured budget', () => {
    const plan = createPlanFixture();
    plan.phases[1]!.steps[0]!.what = 'x'.repeat(2000);

    const prompt = buildAIAgentPrompt(plan, createScanFixture(), createSkillMatch(), { budget: 100 });

    expect(prompt.budgetStatus).toBe('trimmed');
    expect(estimateTokens(serializePrompt(prompt))).toBeGreaterThan(100);
  });
});
