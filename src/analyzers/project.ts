import { analyzeFile } from './ast-parser.js';
import { buildDependencyGraphFromImports } from './dependency-graph.js';
import { discoverFiles } from './file-walker.js';
import { collectProjectCharacteristics, detectSkills } from '../skills/detector.js';
import { loadSkills } from '../skills/loader.js';
import { compareStructure } from '../skills/structure-check.js';
import {
  SUPPORTED_EXTENSIONS,
  type DependencyGraphSummary,
  type FileAnalysis,
  type ParseError
} from '../types/analysis.js';
import type { ArchitectureSkill, SkillMatch, SkillWarning, StructureComparison } from '../types/skill.js';

/**
 * One pass over a project: parse every supported file, build the import graph,
 * detect the stack and compare it against the blueprint's structure.
 * `check`, `init` and `verify` all read from this.
 */
export interface ProjectAnalysis {
  rootDir: string;
  files: FileAnalysis[];
  parseErrors: ParseError[];
  dependencyGraph: DependencyGraphSummary;
  matchedSkills: SkillMatch[];
  primarySkill: ArchitectureSkill | null;
  structureComparison: StructureComparison | null;
  skillLoadWarnings: SkillWarning[];
}

export async function analyzeProject(rootDir: string): Promise<ProjectAnalysis> {
  const filePaths = await discoverFiles(rootDir);
  const files: FileAnalysis[] = [];
  const parseErrors: ParseError[] = [];

  for (const filePath of filePaths) {
    try {
      files.push(await analyzeFile(filePath, rootDir));
    } catch (error) {
      parseErrors.push({
        path: filePath,
        relativePath: filePath.replace(`${rootDir}/`, ''),
        error: error instanceof Error ? error.message : 'Unknown parse error'
      });
    }
  }

  const dependencyGraph = buildDependencyGraphFromImports(
    files,
    [...SUPPORTED_EXTENSIONS],
    parseErrors.length > 0
  );

  const skillLoadResult = await loadSkills();
  const characteristics = await collectProjectCharacteristics(rootDir, filePaths, files);
  const matchedSkills = detectSkills(characteristics, skillLoadResult.skills);
  const primarySkill = (matchedSkills.find((match) => match.primary)?.skill as ArchitectureSkill | undefined) ?? null;
  const structureComparison = await compareStructure(
    rootDir,
    matchedSkills,
    files.map((file) => file.relativePath)
  );

  return {
    rootDir,
    files,
    parseErrors,
    dependencyGraph,
    matchedSkills,
    primarySkill,
    structureComparison,
    skillLoadWarnings: skillLoadResult.warnings
  };
}

export function countFlaggedFiles(analysis: ProjectAnalysis): number {
  return analysis.files.filter((file) => file.isOversized).length;
}

export function countFlaggedFunctions(analysis: ProjectAnalysis): number {
  return analysis.files.reduce(
    (total, file) => total + file.functions.filter((fn) => fn.isFlagged).length,
    0
  );
}

export function totalLoc(analysis: ProjectAnalysis): number {
  return analysis.files.reduce((total, file) => total + file.loc, 0);
}
