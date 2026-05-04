import type { ScanResult } from './analysis.js';
import type { SkillMatch } from './skill.js';

export type PlanRisk = 'low' | 'medium' | 'high';
export type PlanComplexity = 'low' | 'medium' | 'high';
export type RefactorAction = 'create_dir' | 'extract' | 'move' | 'consolidate' | 'delete' | 'update_imports';
export type PlanValidationSeverity = 'warning' | 'error';
export type PlanOutputFormat = 'terminal' | 'md' | 'json' | 'prompt';

export interface RefactorPlan {
  summary: string;
  estimatedComplexity: PlanComplexity;
  estimatedRisk: PlanRisk;
  phases: PlanPhase[];
  validationFindings: PlanValidationFinding[];
  assumptions: string[];
  source: {
    targetDir: string;
    primarySkillId: string | null;
    healthLabel: string;
    issueCount: number;
  };
}

export interface PlanPhase {
  name: string;
  description: string;
  steps: RefactorStep[];
}

export interface RefactorStep {
  stepNumber: number;
  action: RefactorAction;
  sourceFile: string | null;
  targetFile: string;
  what: string;
  why: string;
  lineRange: string | null;
  importsToUpdate: string[];
  dependencyNotes: string;
  risk: PlanRisk;
  confidence: 'low' | 'medium' | 'high';
}

export interface PlanValidationFinding {
  severity: PlanValidationSeverity;
  stepNumber: number | null;
  message: string;
  suggestion: string;
}

export interface PlanGenerationContext {
  scan: ScanResult;
  primarySkill: SkillMatch | null;
}

export interface AIAgentPrompt {
  projectContext: string;
  skillBlueprint: string;
  plan: string;
  constraints: string[];
  budgetStatus: 'within_budget' | 'trimmed';
}
