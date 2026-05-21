import type { FileAnalysis } from '../types/analysis.js';
import type { DimensionScore } from '../types/scoring.js';

const WEIGHT = 25;

export function scoreFileSizeDistribution(files: FileAnalysis[]): DimensionScore {
  if (files.length === 0) {
    return { score: 100, weight: WEIGHT, label: 'healthy', reasons: ['No analyzable files found'] };
  }

  const totalLoc = files.reduce((total, file) => total + file.loc, 0);
  const oversizedFiles = files.filter((file) => file.loc > 300).length;
  const avgLoc = totalLoc / files.length;
  const largestFileLoc = Math.max(...files.map((file) => file.loc));
  const singleFileRatio = totalLoc === 0 ? 0 : largestFileLoc / totalLoc;
  const reasons: string[] = [];
  let score = 100;

  if (oversizedFiles > 0) {
    score -= Math.min(30, (oversizedFiles / files.length) * 40);
    reasons.push(`${oversizedFiles} oversized file(s) (>300 LOC)`);
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
