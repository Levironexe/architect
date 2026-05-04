import { describe, expect, it } from 'vitest';

import { generateRefactorPlan, primarySkillFrom } from '../../../src/planner/plan-generator';
import { createCleanScanFixture, createScanFixture } from './plan-fixtures';

describe('generateRefactorPlan', () => {
  it('creates ordered steps from structure gaps, oversized files, duplication, dependency hotspots, and classifications', () => {
    const scan = createScanFixture();
    const plan = generateRefactorPlan({ scan, primarySkill: primarySkillFrom(scan) });

    expect(plan.phases.length).toBeGreaterThan(0);
    expect(plan.phases.flatMap((phase) => phase.steps).length).toBeGreaterThanOrEqual(5);
    expect(plan.phases[0]?.steps[0]?.targetFile).toBe('src/routes');
    expect(plan.summary).toContain('Express.js REST API');
    expect(plan.estimatedComplexity).toBe('medium');
    expect(plan.estimatedRisk).toBe('medium');
    expect(plan.phases.flatMap((phase) => phase.steps).map((step) => step.stepNumber)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('creates a lightweight maintenance roadmap for clean projects', () => {
    const scan = createCleanScanFixture();
    const plan = generateRefactorPlan({ scan, primarySkill: primarySkillFrom(scan) });
    const steps = plan.phases.flatMap((phase) => phase.steps);

    expect(steps).toHaveLength(1);
    expect(steps[0]?.risk).toBe('low');
    expect(steps[0]?.dependencyNotes).toContain('None');
  });

  it('raises risk when circular dependencies are present', () => {
    const scan = createScanFixture({
      summary: { ...createScanFixture().summary, circularDependencies: 1 },
      dependencyGraph: {
        ...createScanFixture().dependencyGraph,
        circularDependencies: [{ files: ['src/a.ts', 'src/b.ts', 'src/a.ts'] }]
      }
    });

    const plan = generateRefactorPlan({ scan, primarySkill: primarySkillFrom(scan) });

    expect(plan.estimatedRisk).toBe('high');
    expect(plan.phases.flatMap((phase) => phase.steps).some((step) => step.what.includes('Break circular dependency'))).toBe(true);
  });
});
