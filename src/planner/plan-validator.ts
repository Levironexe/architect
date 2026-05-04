import type { RefactorAction, RefactorPlan, PlanValidationFinding } from '../types/plan.js';

const SUPPORTED_ACTIONS: RefactorAction[] = ['create_dir', 'extract', 'move', 'consolidate', 'delete', 'update_imports'];
const SOURCE_REQUIRED_ACTIONS: RefactorAction[] = ['extract', 'move', 'consolidate', 'delete'];

export function validateRefactorPlan(plan: RefactorPlan): RefactorPlan {
  return {
    ...plan,
    validationFindings: [...plan.validationFindings, ...collectValidationFindings(plan)]
  };
}

export function collectValidationFindings(plan: RefactorPlan): PlanValidationFinding[] {
  const findings: PlanValidationFinding[] = [];
  const steps = plan.phases.flatMap((phase) => phase.steps);

  if (plan.phases.length === 0) {
    findings.push(error(null, 'Plan has no phases.', 'Generate at least one phase before rendering the plan.'));
  }

  if (steps.length === 0) {
    findings.push(error(null, 'Plan has no actionable steps.', 'Generate at least one maintenance or refactoring step.'));
  }

  steps.forEach((step, index) => {
    if (step.stepNumber !== index + 1) {
      findings.push(error(step.stepNumber, `Expected step number ${index + 1} but found ${step.stepNumber}.`, 'Renumber plan steps sequentially across all phases.'));
    }

    if (!SUPPORTED_ACTIONS.includes(step.action)) {
      findings.push(error(step.stepNumber, `Unsupported action: ${step.action}.`, `Use one of: ${SUPPORTED_ACTIONS.join(', ')}.`));
    }

    if (!step.targetFile.trim()) {
      findings.push(error(step.stepNumber, 'Step is missing a target location.', 'Add the file or directory the step should create or change.'));
    }

    if (!step.what.trim() || !step.why.trim()) {
      findings.push(error(step.stepNumber, 'Step is missing action detail or explanation.', 'Add both what to change and why it matters.'));
    }

    if (!Array.isArray(step.importsToUpdate)) {
      findings.push(error(step.stepNumber, 'Step importsToUpdate must be a list.', 'Use an empty list when no imports are known.'));
    }

    if (SOURCE_REQUIRED_ACTIONS.includes(step.action) && !step.sourceFile) {
      findings.push(warning(step.stepNumber, `Step ${step.action} has no source location.`, 'Add a source file or explain the source in the step text before execution.'));
    }

    if (step.risk === 'high' && step.importsToUpdate.length === 0 && step.dependencyNotes.toLowerCase().includes('no known') === false) {
      findings.push(warning(step.stepNumber, 'High-risk step does not list imports to update.', 'Review dependency graph before executing this step.'));
    }
  });

  return findings;
}

function error(stepNumber: number | null, message: string, suggestion: string): PlanValidationFinding {
  return { severity: 'error', stepNumber, message, suggestion };
}

function warning(stepNumber: number | null, message: string, suggestion: string): PlanValidationFinding {
  return { severity: 'warning', stepNumber, message, suggestion };
}
