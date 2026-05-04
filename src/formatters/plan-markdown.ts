import type { RefactorPlan, RefactorStep } from '../types/plan.js';

export function renderPlanMarkdown(plan: RefactorPlan): string {
  const lines: string[] = [
    '# Refactoring Plan',
    '',
    plan.summary,
    '',
    `- Complexity: ${plan.estimatedComplexity}`,
    `- Risk: ${plan.estimatedRisk}`,
    `- Health: ${plan.source.healthLabel}`,
    `- Issues considered: ${plan.source.issueCount}`,
    ''
  ];

  for (const phase of plan.phases) {
    lines.push(`## ${phase.name}`, '', phase.description, '');
    for (const step of phase.steps) {
      lines.push(formatStep(step));
    }
    lines.push('');
  }

  if (plan.validationFindings.length > 0) {
    lines.push('## Validation Findings', '');
    for (const finding of plan.validationFindings) {
      const step = finding.stepNumber === null ? 'plan' : `step ${finding.stepNumber}`;
      lines.push(`- **${finding.severity}** (${step}): ${finding.message} ${finding.suggestion}`);
    }
    lines.push('');
  }

  if (plan.assumptions.length > 0) {
    lines.push('## Assumptions', '');
    for (const assumption of plan.assumptions) {
      lines.push(`- ${assumption}`);
    }
    lines.push('');
  }

  return `${lines.join('\n').trimEnd()}\n`;
}

function formatStep(step: RefactorStep): string {
  const source = step.sourceFile ?? 'none';
  const imports = step.importsToUpdate.length > 0 ? step.importsToUpdate.join(', ') : 'none';
  return `- [ ] **${step.stepNumber}. ${step.action}** ${step.what}\n  - Source: ${source}\n  - Target: ${step.targetFile}\n  - Why: ${step.why}\n  - Dependency notes: ${step.dependencyNotes}\n  - Imports to update: ${imports}\n  - Risk: ${step.risk}`;
}
