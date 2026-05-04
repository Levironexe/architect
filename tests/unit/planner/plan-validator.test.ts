import { describe, expect, it } from 'vitest';

import { collectValidationFindings, validateRefactorPlan } from '../../../src/planner/plan-validator';
import { createPlanFixture } from './plan-fixtures';

describe('validateRefactorPlan', () => {
  it('returns a plan with validation findings attached', () => {
    const plan = createPlanFixture();
    plan.phases[1]!.steps[0]!.importsToUpdate = [];
    plan.phases[1]!.steps[0]!.dependencyNotes = 'Review manually.';

    const validated = validateRefactorPlan(plan);

    expect(validated.validationFindings.some((finding) => finding.severity === 'warning')).toBe(false);
  });

  it('flags missing target, missing source, unsupported action, and non-sequential steps', () => {
    const plan = createPlanFixture();
    plan.phases[0]!.steps[0]!.targetFile = '';
    plan.phases[1]!.steps[0]!.sourceFile = null;
    plan.phases[1]!.steps[0]!.stepNumber = 5;
    plan.phases[1]!.steps.push({
      ...plan.phases[1]!.steps[0]!,
      stepNumber: 3,
      action: 'unsupported' as never,
      sourceFile: 'server.ts'
    });

    const findings = collectValidationFindings(plan);

    expect(findings.map((finding) => finding.message).join('\n')).toContain('missing a target');
    expect(findings.map((finding) => finding.message).join('\n')).toContain('source location');
    expect(findings.map((finding) => finding.message).join('\n')).toContain('Unsupported action');
    expect(findings.map((finding) => finding.message).join('\n')).toContain('Expected step number 2');
  });
});
