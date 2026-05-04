import { buildAIAgentPrompt, serializePrompt } from '../planner/plan-prompt-builder.js';
import type { ScanResult } from '../types/analysis.js';
import type { RefactorPlan } from '../types/plan.js';
import type { SkillMatch } from '../types/skill.js';

export function renderPlanPrompt(plan: RefactorPlan, scan: ScanResult, primarySkill: SkillMatch | null): string {
  return `${serializePrompt(buildAIAgentPrompt(plan, scan, primarySkill))}\n`;
}
