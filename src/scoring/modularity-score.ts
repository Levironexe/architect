import type { FileAnalysis } from '../types/analysis.js';
import type { DimensionScore } from '../types/scoring.js';

const WEIGHT = 25;

export function scoreModularity(files: FileAnalysis[]): DimensionScore {
  if (files.length === 0) {
    return {
      score: 100,
      weight: WEIGHT,
      label: 'healthy',
      reasons: ['No analyzable files found']
    };
  }

  const totalLoc = files.reduce((total, file) => total + file.loc, 0);
  const oversizedFiles = files.filter((file) => file.loc > 300).length;
  const functions = files.flatMap((file) => file.functions);
  const oversizedFunctions = functions.filter((fn) => fn.loc > 50).length;
  const averageFunctionsPerFile = functions.length / files.length;
  const largestFileLoc = Math.max(...files.map((file) => file.loc));
  const singleFileRatio = totalLoc === 0 ? 0 : largestFileLoc / totalLoc;
  const reasons: string[] = [];
  let score = 100;

  if (oversizedFiles > 0) {
    score -= Math.min(30, (oversizedFiles / files.length) * 40);
    reasons.push(`${oversizedFiles} oversized file(s)`);
  }

  if (oversizedFunctions > 0) {
    score -= Math.min(25, (oversizedFunctions / Math.max(functions.length, 1)) * 35);
    reasons.push(`${oversizedFunctions} oversized function(s)`);
  }

  if (averageFunctionsPerFile > 8) {
    score -= 15;
    reasons.push('high average functions per file');
  }

  if (totalLoc > 100 && singleFileRatio > 0.5) {
    score -= singleFileRatio > 0.8 ? 45 : 30;
    reasons.push('single file holds most project code');
  }

  const finalScore = clampScore(score);

  return {
    score: finalScore,
    weight: WEIGHT,
    label: labelForScore(finalScore),
    reasons: reasons.length > 0 ? reasons : ['Files and functions are well distributed']
  };
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function labelForScore(score: number): DimensionScore['label'] {
  if (score >= 80) {
    return 'healthy';
  }

  if (score >= 50) {
    return 'warning';
  }

  return 'critical';
}
