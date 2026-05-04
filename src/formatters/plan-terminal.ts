import chalk from 'chalk';

import type { RefactorPlan, RefactorStep } from '../types/plan.js';

export interface PlanTerminalOptions {
  color?: boolean;
}

export function renderPlanTerminal(plan: RefactorPlan, options: PlanTerminalOptions = {}): string {
  const color = options.color !== false;
  const heading = color ? chalk.bold : (value: string) => value;
  const muted = color ? chalk.gray : (value: string) => value;
  const risk = color ? riskColor(plan.estimatedRisk) : (value: string) => value;
  const lines: string[] = [
    heading('Refactoring plan'),
    plan.summary,
    '',
    `Complexity: ${plan.estimatedComplexity}`,
    `Risk: ${risk(plan.estimatedRisk)}`,
    `Health: ${plan.source.healthLabel}`,
    ''
  ];

  for (const phase of plan.phases) {
    lines.push(heading(phase.name), phase.description);
    for (const step of phase.steps) {
      lines.push(formatStep(step, muted));
    }
    lines.push('');
  }

  if (plan.validationFindings.length > 0) {
    lines.push(heading('Validation findings'));
    for (const finding of plan.validationFindings) {
      const location = finding.stepNumber === null ? 'plan' : `step ${finding.stepNumber}`;
      lines.push(`- ${finding.severity.toUpperCase()} ${location}: ${finding.message}`);
      lines.push(`  Suggestion: ${finding.suggestion}`);
    }
    lines.push('');
  }

  if (plan.assumptions.length > 0) {
    lines.push(heading('Assumptions'));
    for (const assumption of plan.assumptions) {
      lines.push(`- ${assumption}`);
    }
    lines.push('');
  }

  lines.push(muted('Export with --format md, --format json, or --format prompt.'));
  return `${lines.join('\n').trimEnd()}\n`;
}

function formatStep(step: RefactorStep, muted: (value: string) => string): string {
  const source = step.sourceFile ?? 'none';
  const imports = step.importsToUpdate.length > 0 ? step.importsToUpdate.join(', ') : 'none';
  return [
    `${step.stepNumber}. [${step.risk}] ${step.what}`,
    `   ${muted('action')}: ${step.action}`,
    `   ${muted('source')}: ${source}`,
    `   ${muted('target')}: ${step.targetFile}`,
    `   ${muted('why')}: ${step.why}`,
    `   ${muted('dependencies')}: ${step.dependencyNotes}`,
    `   ${muted('imports')}: ${imports}`
  ].join('\n');
}

function riskColor(risk: RefactorPlan['estimatedRisk']): (value: string) => string {
  if (risk === 'high') return chalk.red;
  if (risk === 'medium') return chalk.yellow;
  return chalk.green;
}
