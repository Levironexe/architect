import type { RefactorPlan } from '../types/plan.js';

export interface PlanParseResult {
  ok: boolean;
  plan: RefactorPlan | null;
  error: string | null;
}

export function parseRefactorPlanResponse(response: string): PlanParseResult {
  try {
    const parsed = JSON.parse(extractJson(response)) as RefactorPlan;
    if (!parsed || !Array.isArray(parsed.phases) || typeof parsed.summary !== 'string') {
      return { ok: false, plan: null, error: 'Response did not contain a valid RefactorPlan shape.' };
    }

    return { ok: true, plan: parsed, error: null };
  } catch (error) {
    return {
      ok: false,
      plan: null,
      error: error instanceof Error ? error.message : 'Failed to parse plan response.'
    };
  }
}

function extractJson(response: string): string {
  const fenced = response.match(/```(?:json)?\s*([\s\S]*?)```/);
  return fenced?.[1]?.trim() ?? response.trim();
}
