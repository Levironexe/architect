export const SUPPORTED_SKILL_SCHEMA_VERSION = '1.0.0';

export type SkillCategory = 'stack' | 'pattern' | 'meta';
export type SkillConfidence = 'high' | 'medium' | 'low';
export type IssueSeverity = 'info' | 'warning' | 'critical';

export interface ArchitectureSkill {
  schemaVersion: string;
  id: string;
  name: string;
  version: string;
  description: string;
  category: SkillCategory;
  language: string;
  frameworks: string[];
  detection: DetectionRules;
  structure: TargetStructure;
  separation: SeparationRules;
  patterns: PatternRules;
  antiPatterns: AntiPattern[];
}

export interface DetectionRules {
  dependencies?: {
    any?: string[];
    all?: string[];
    none?: string[];
  };
  files?: string[];
  sourceIndicators?: string[];
}

export interface TargetStructure {
  requiredDirs: StructureEntry[];
  recommendedDirs: StructureEntry[];
}

export interface StructureEntry {
  path: string;
  purpose: string;
}

export interface SeparationRules {
  rules: SeparationRule[];
}

export interface SeparationRule {
  concern: string;
  belongsIn: string;
  indicators?: string[];
  antiIndicators?: string[];
}

export interface PatternRules {
  naming?: Record<string, string>;
  dataFlow?: {
    direction: string;
    rules: string[];
  };
  errorHandling?: {
    recommended: string;
  };
  custom?: Record<string, unknown>;
}

export interface AntiPattern {
  id: string;
  severity: IssueSeverity;
  description: string;
}

export interface SkillWarning {
  file: string;
  message: string;
}

export interface SkillLoadResult {
  skills: ArchitectureSkill[];
  warnings: SkillWarning[];
}

export interface ProjectCharacteristics {
  rootDir: string;
  dependencies: Set<string>;
  files: string[];
  sourceText: string;
}

export interface SkillMatch {
  skill: ArchitectureSkill;
  confidence: SkillConfidence;
  score: number;
  reasons: string[];
  primary: boolean;
}

export interface StructureComparison {
  skillId: string;
  entries: StructureComparisonEntry[];
  isAvailable: boolean;
}

export interface StructureComparisonEntry {
  path: string;
  purpose: string;
  required: boolean;
  status: 'present' | 'missing';
}
