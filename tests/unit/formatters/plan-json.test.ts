import { describe, expect, it } from 'vitest';

import { renderPlanJson } from '../../../src/formatters/plan-json';
import { createPlanFixture } from '../planner/plan-fixtures';

describe('renderPlanJson', () => {
  it('renders parseable structured plan output without ANSI styling', () => {
    const output = renderPlanJson(createPlanFixture());
    const parsed = JSON.parse(output) as ReturnType<typeof createPlanFixture>;

    expect(parsed.summary).toContain('fixture project');
    expect(parsed.phases).toHaveLength(2);
    expect(output).not.toContain('\u001b[');
  });
});
