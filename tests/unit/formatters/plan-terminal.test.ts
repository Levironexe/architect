import { describe, expect, it } from 'vitest';

import { renderPlanTerminal } from '../../../src/formatters/plan-terminal';
import { createPlanFixture } from '../planner/plan-fixtures';

describe('renderPlanTerminal', () => {
  it('renders readable phases, ordered steps, risk, complexity, and no-color output', () => {
    const plan = createPlanFixture();
    plan.validationFindings = [{ severity: 'warning', stepNumber: 2, message: 'Check imports.', suggestion: 'Review dependency graph.' }];

    const output = renderPlanTerminal(plan, { color: false });

    expect(output).toContain('Refactoring plan');
    expect(output).toContain('Complexity: medium');
    expect(output).toContain('Risk: medium');
    expect(output).toContain('Prepare target structure');
    expect(output).toContain('1. [low] Create route directory.');
    expect(output).toContain('Validation findings');
    expect(output).not.toContain('\u001b[');
  });
});
