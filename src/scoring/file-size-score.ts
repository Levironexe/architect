import type { FileAnalysis } from '../types/analysis.js';
import type { DimensionScore } from '../types/scoring.js';

const WEIGHT = 25;

export function scoreFileSizeDistribution(files: FileAnalysis[]): DimensionScore {
  if (files.length === 0) {
    return { score: 100, weight: WEIGHT, label: 'healthy', reasons: ['No analyzable files found'] };
  }

  const totalLoc = files.reduce((total, file) => total + file.loc, 0);
  const oversizedFiles = files.filter((file) => file.loc > 300);
  const avgLoc = totalLoc / files.length;
  const largestFileLoc = Math.max(...files.map((file) => file.loc));
  const singleFileRatio = totalLoc === 0 ? 0 : largestFileLoc / totalLoc;
  const reasons: string[] = [];
  let score = 100;

  if (oversizedFiles.length > 0) {
    const countPenalty = Math.min(20, (oversizedFiles.length / files.length) * 40);
    const severityPenalty = oversizedFiles.reduce((total, file) => {
      const excess = file.loc - 300;
      if (excess > 200) return total + 8;
      if (excess > 100) return total + 5;
      return total + 2;
    }, 0);
    score -= Math.min(45, countPenalty + severityPenalty);
    reasons.push(`${oversizedFiles.length} oversized file(s) (>300 LOC)`);
    const godFiles = oversizedFiles.filter((file) => file.loc > 400);
    if (godFiles.length > 0) {
      reasons.push(`${godFiles.length} god file(s) (>400 LOC): ${godFiles.map((f) => f.relativePath).join(', ')}`);
    }
  }

  if (avgLoc > 150) {
    score -= 15;
    reasons.push('high average LOC per file');
  }

  if (totalLoc > 100 && singleFileRatio > 0.5) {
    score -= singleFileRatio > 0.8 ? 45 : 30;
    reasons.push('single file holds most project code');
  }

  const finalScore = Math.max(0, Math.min(100, Math.round(score)));
  const label: DimensionScore['label'] = finalScore >= 80 ? 'healthy' : finalScore >= 50 ? 'warning' : 'critical';

  return {
    score: finalScore,
    weight: WEIGHT,
    label,
    reasons: reasons.length > 0 ? reasons : ['Files are well distributed']
  };
}
