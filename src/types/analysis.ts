export const DEFAULT_LOC_THRESHOLD = 300;
export const DEFAULT_COMPLEXITY_THRESHOLD = 15;

export const SUPPORTED_EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx'] as const;
export const ALWAYS_EXCLUDED_DIRS = ['node_modules', '.git', 'dist', 'build'] as const;

export type SupportedExtension = (typeof SUPPORTED_EXTENSIONS)[number];

export interface FunctionInfo {
  name: string;
  paramCount: number;
  startLine: number;
  endLine: number;
  loc: number;
  complexity: number;
  isFlagged: boolean;
}

export interface ClassInfo {
  name: string;
  startLine: number;
  endLine: number;
  methodCount: number;
}

export interface ImportInfo {
  source: string;
  isRelative: boolean;
  isBuiltin: boolean;
  specifiers: string[];
}

export interface ExportInfo {
  name: string;
  kind: 'named' | 'default' | 'all';
}

export interface FileAnalysis {
  path: string;
  relativePath: string;
  loc: number;
  blankLines: number;
  commentLines: number;
  totalLines: number;
  functions: FunctionInfo[];
  classes: ClassInfo[];
  imports: ImportInfo[];
  exports: ExportInfo[];
  isOversized: boolean;
  hasCriticalComplexity: boolean;
  parseError: string | null;
}

export interface ParseError {
  path: string;
  relativePath: string;
  error: string;
}

export interface DependencyNode {
  path: string;
  relativePath: string;
  imports: string[];
  importedBy: string[];
}

export interface CircularDependencyChain {
  files: string[];
}

export interface DependencyHotspot {
  relativePath: string;
  dependentCount: number;
}

export interface DependencyGraphSummary {
  nodes: DependencyNode[];
  circularDependencies: CircularDependencyChain[];
  hotspots: DependencyHotspot[];
  unreferencedFiles: string[];
  isPartial: boolean;
}

export interface DuplicationOccurrence {
  relativePath: string;
  startLine: number;
  endLine: number;
}

export interface DuplicationFinding {
  occurrences: DuplicationOccurrence[];
  duplicatedLines: number;
  similarity: number | null;
}

export interface DuplicationSummary {
  findings: DuplicationFinding[];
  duplicatedLines: number;
  duplicationPercentage: number;
  isPartial: boolean;
}

export interface ScanSummary {
  targetDir: string;
  totalFiles: number;
  skippedFiles: number;
  totalLoc: number;
  totalLines: number;
  flaggedFiles: number;
  flaggedFunctions: number;
  dependencyHotspots: number;
  circularDependencies: number;
  duplicateFindings: number;
  duplicatedLines: number;
  scanDurationMs: number;
}

import type { FullScoreBreakdown, ScoreBreakdown } from './scoring.js';
import type { SkillMatch, SkillWarning, StructureComparison } from './skill.js';
import type { ClassificationStatus, ConcernClassification } from './concern.js';
import type { PatternFinding } from './pattern.js';
import type { ReportGuidance, ReportIssue } from './issue.js';

export interface ScanResult {
  summary: ScanSummary;
  files: FileAnalysis[];
  parseErrors: ParseError[];
  dependencyGraph: DependencyGraphSummary;
  duplication: DuplicationSummary;
  skillLoadWarnings?: SkillWarning[];
  matchedSkills?: SkillMatch[];
  structureComparison?: StructureComparison | null;
  scores?: ScoreBreakdown;
  health?: FullScoreBreakdown['health'];
  dimensions?: FullScoreBreakdown['dimensions'];
  patternFindings?: PatternFinding[];
  issues?: ReportIssue[];
  guidance?: ReportGuidance;
  classifications?: ConcernClassification[];
  classificationStatus?: ClassificationStatus;
}

export interface ScanOptions {
  cwd?: string;
  color?: boolean;
  locThreshold?: number;
  complexityThreshold?: number;
}

export function createEmptySummary(targetDir: string): ScanSummary {
  return {
    targetDir,
    totalFiles: 0,
    skippedFiles: 0,
    totalLoc: 0,
    totalLines: 0,
    flaggedFiles: 0,
    flaggedFunctions: 0,
    dependencyHotspots: 0,
    circularDependencies: 0,
    duplicateFindings: 0,
    duplicatedLines: 0,
    scanDurationMs: 0
  };
}

export function createEmptyDependencyGraphSummary(isPartial = false): DependencyGraphSummary {
  return {
    nodes: [],
    circularDependencies: [],
    hotspots: [],
    unreferencedFiles: [],
    isPartial
  };
}

export function createEmptyDuplicationSummary(isPartial = false): DuplicationSummary {
  return {
    findings: [],
    duplicatedLines: 0,
    duplicationPercentage: 0,
    isPartial
  };
}

export function isSupportedExtension(filePath: string): boolean {
  return SUPPORTED_EXTENSIONS.some((extension) => filePath.endsWith(extension));
}
