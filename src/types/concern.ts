import type { ImportInfo } from './analysis.js';
import type { SeparationRule } from './skill.js';

export const CONCERN_TYPES = [
  'routing',
  'business_logic',
  'data_access',
  'validation',
  'middleware',
  'ui_component',
  'utility',
  'configuration',
  'test',
  'unclassified'
] as const;

export type ConcernType = (typeof CONCERN_TYPES)[number];
export type ClassificationMode = 'completed' | 'skipped' | 'partial' | 'failed';

export interface FunctionSignatureSummary {
  name: string;
  paramCount: number;
  startLine: number;
  endLine: number;
}

export interface FileClassificationInput {
  relativePath: string;
  imports: ImportInfo[];
  functions: FunctionSignatureSummary[];
}

export interface ClassificationSkillContext {
  id: string;
  name: string;
  separationRules: SeparationRule[];
}

export interface ClassificationRequest {
  projectRoot: string;
  skill: ClassificationSkillContext | null;
  files: FileClassificationInput[];
  tokenBudget: number;
}

export interface FunctionConcernClassification {
  name: string;
  concern: ConcernType;
  confidence: number;
  isMisplaced: boolean;
  reason?: string;
}

export interface ConcernClassification {
  file: string;
  functions: FunctionConcernClassification[];
  dominantConcern: ConcernType;
  mixedConcerns: boolean;
  warnings: string[];
}

export interface ClassificationStatus {
  mode: ClassificationMode;
  provider?: string;
  reason?: string;
  warnings: string[];
}

export function isConcernType(value: string): value is ConcernType {
  return CONCERN_TYPES.includes(value as ConcernType);
}
