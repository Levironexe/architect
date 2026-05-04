import type { RefactorPlan } from '../types/plan.js';

export function renderPlanJson(plan: RefactorPlan): string {
  return `${JSON.stringify(plan, null, 2)}\n`;
}
