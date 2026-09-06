export interface PlanVerifyCheck {
  phase: number;
  step: string;
  command: string;
  expectation: string;
}

export function extractVerifyChecks(planContent: string, phase: number): PlanVerifyCheck[] {
  const checks: PlanVerifyCheck[] = [];
  const lines = planContent.split('\n');

  let currentStep = '';
  let inTargetPhase = false;

  for (const line of lines) {
    const phaseMatch = line.match(/^## Phase (\d+):/);
    if (phaseMatch) {
      inTargetPhase = parseInt(phaseMatch[1]!, 10) === phase;
      continue;
    }

    if (phaseMatch === null && /^## /.test(line) && inTargetPhase) {
      break;
    }

    if (!inTargetPhase) continue;

    const stepMatch = line.match(/^- \[[ x]\] Step (\d+\.\d+):/);
    if (stepMatch) {
      currentStep = `Step ${stepMatch[1]}`;
      continue;
    }

    const verifyMatch = line.match(/- Verify:\s+`(.+?)`\s*(.*)/);
    if (verifyMatch && verifyMatch[1]) {
      checks.push({
        phase,
        step: currentStep,
        command: verifyMatch[1],
        expectation: verifyMatch[2] ?? 'should return zero results'
      });
    }
  }

  return checks;
}
