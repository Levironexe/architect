import {
  countFlaggedFiles,
  countFlaggedFunctions,
  totalLoc,
  type ProjectAnalysis
} from '../analyzers/project.js';
import type { ScanSnapshot } from '../types/state.js';

export function extractSnapshot(analysis: ProjectAnalysis): ScanSnapshot {
  const loc = totalLoc(analysis);
  const totalFiles = analysis.files.length;

  return {
    timestamp: new Date().toISOString(),
    flagged_files: countFlaggedFiles(analysis),
    flagged_functions: countFlaggedFunctions(analysis),
    circular_deps: analysis.dependencyGraph.circularDependencies.length,
    total_files: totalFiles,
    total_loc: loc,
    avg_file_loc: totalFiles > 0 ? Math.round(loc / totalFiles) : 0,
    god_files: analysis.files.filter((file) => file.loc > 300).length
  };
}
