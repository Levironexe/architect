import { describe, expect, it } from 'vitest';

import { parseRefactorPlanResponse } from '../../../src/planner/plan-response-parser';
import { createPlanFixture } from './plan-fixtures';

describe('parseRefactorPlanResponse', () => {
  it('parses raw and fenced plan JSON', () => {
    const plan = createPlanFixture();

    expect(parseRefactorPlanResponse(JSON.stringify(plan)).ok).toBe(true);
    expect(parseRefactorPlanResponse(`\`\`\`json\n${JSON.stringify(plan)}\n\`\`\``).plan?.summary).toBe(plan.summary);
  });

  it('returns a deterministic failure for invalid provider output', () => {
    const result = parseRefactorPlanResponse('not json');

    expect(result.ok).toBe(false);
    expect(result.plan).toBeNull();
    expect(result.error).toBeTruthy();
  });
});
