import type { DependencyGraphSummary, DeadCodeFinding } from '../types/analysis.js';
import type { DimensionScore } from '../types/scoring.js';

const WEIGHT = 20;

export function scoreArchitecture(
  dependencyGraph: DependencyGraphSummary,
  deadCode: DeadCodeFinding[] | undefined
): DimensionScore {
  const reasons: string[] = [];
  let score = 100;

  const circularCount = dependencyGraph.circularDependencies.length;
  if (circularCount > 0) {
    const penalty = Math.min(40, circularCount * 10);
    score -= penalty;
    reasons.push(`${circularCount} circular dependency chain(s)`);
  }

  const hotspotCount = dependencyGraph.hotspots.length;
  if (hotspotCount > 0) {
    const severeHotspots = dependencyGraph.hotspots.filter((h) => h.dependentCount >= 15);
    if (severeHotspots.length > 0) {
      score -= Math.min(20, severeHotspots.length * 10);
      reasons.push(`${severeHotspots.length} severe hub file(s) (15+ dependents)`);
    }
  }

  if (deadCode && deadCode.length > 0) {
    const orphanedFiles = deadCode.filter((d) => !d.export);
    const unusedExports = deadCode.filter((d) => d.export);
    if (orphanedFiles.length > 10) {
      score -= Math.min(15, Math.floor(orphanedFiles.length / 5) * 5);
      reasons.push(`${orphanedFiles.length} unreferenced files`);
    }
    if (unusedExports.length > 20) {
      score -= Math.min(10, Math.floor(unusedExports.length / 10) * 5);
      reasons.push(`${unusedExports.length} unused exports`);
    }
  }

  const finalScore = Math.max(0, Math.min(100, Math.round(score)));
  return {
    score: finalScore,
    weight: WEIGHT,
    label: finalScore >= 80 ? 'healthy' : finalScore >= 50 ? 'warning' : 'critical',
    reasons: reasons.length > 0 ? reasons : ['No architectural issues detected']
  };
}
