import type { DimensionScore, HealthLabel, ScoreBreakdown } from '../types/scoring.js';

export function calculateHealthScore(modularity: DimensionScore, duplication: DimensionScore): ScoreBreakdown {
  const overall = clampScore(modularity.score * 0.65 + duplication.score * 0.35);
  return {
    modularity,
    duplication,
    overall,
    label: labelForScore(overall)
  };
}

export function calculateLiteHealthScore(fileSizeDistribution: DimensionScore, duplication: DimensionScore): ScoreBreakdown {
  const overall = clampScore(fileSizeDistribution.score * 0.65 + duplication.score * 0.35);
  return {
    modularity: fileSizeDistribution,
    duplication,
    overall,
    label: labelForScore(overall),
    fileSizeDistribution,
    tier: 'lite'
  };
}

export function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function labelForScore(score: number): Exclude<HealthLabel, 'unavailable'> {
  if (score >= 80) return 'healthy';
  if (score >= 50) return 'warning';
  return 'critical';
}
