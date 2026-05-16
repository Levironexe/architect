import type { DimensionScore } from '../../../src/types/scoring';

export function dimensionScore(score: number, weight: number): DimensionScore {
  const label = score >= 80 ? 'healthy' : score >= 50 ? 'warning' : 'critical';
  return { score, weight, label, reasons: [`score ${score}`] };
}
