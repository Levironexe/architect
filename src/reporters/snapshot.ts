import type { ScanResult } from '../types/analysis.js';
import type { ScanSnapshot } from '../types/state.js';

export function extractSnapshot(result: ScanResult): ScanSnapshot {
  const totalLoc = result.summary.totalLoc;
  const totalFiles = result.summary.totalFiles;
  const avgFileLoc = totalFiles > 0 ? Math.round(totalLoc / totalFiles) : 0;
  const godFiles = result.files.filter((f) => f.loc > 300).length;

  return {
    timestamp: new Date().toISOString(),
    health_score: result.scores?.overall ?? 0,
    flagged_files: result.summary.flaggedFiles,
    flagged_functions: result.summary.flaggedFunctions,
    circular_deps: result.summary.circularDependencies,
    duplication_pct: result.duplication.duplicationPercentage,
    total_files: totalFiles,
    total_loc: totalLoc,
    avg_file_loc: avgFileLoc,
    god_files: godFiles,
  };
}
