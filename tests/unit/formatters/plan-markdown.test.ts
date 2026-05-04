import { describe, expect, it } from 'vitest';

import { renderPlanMarkdown } from '../../../src/formatters/plan-markdown';
import { createPlanFixture } from '../planner/plan-fixtures';

describe('renderPlanMarkdown', () => {
  it('renders issue-tracker-friendly checklist steps and validation findings', () => {
    const plan = createPlanFixture();
    plan.validationFindings = [{ severity: 'warning', stepNumber: 1, message: 'Review target.', suggestion: 'Confirm directory name.' }];

    const output = renderPlanMarkdown(plan);

    expect(output).toContain('# Refactoring Plan');
    expect(output).toContain('## Prepare target structure');
    expect(output).toContain('- [ ] **1. create_dir**');
    expect(output).toContain('## Validation Findings');
    expect(output).toContain('Confirm directory name');
  });
});
