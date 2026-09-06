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
  line: number;
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

export interface ExportHub {
  relativePath: string;
  exportCount: number;
}

export interface DependencyGraphSummary {
  nodes: DependencyNode[];
  circularDependencies: CircularDependencyChain[];
  hotspots: DependencyHotspot[];
  exportHubs: ExportHub[];
  unreferencedFiles: string[];
  isPartial: boolean;
}

export interface DuplicationOccurrence {
  relativePath: string;
  startLine: number;
  endLine: number;
}



export function createEmptyDependencyGraphSummary(isPartial = false): DependencyGraphSummary {
  return {
    nodes: [],
    circularDependencies: [],
    hotspots: [],
    exportHubs: [],
    unreferencedFiles: [],
    isPartial
  };
}


export function isSupportedExtension(filePath: string): boolean {
  return SUPPORTED_EXTENSIONS.some((extension) => filePath.endsWith(extension));
}
