import type { DuplicationSummary } from '../types/analysis.js';
import type { DimensionScore } from '../types/scoring.js';

const WEIGHT = 20;

export function scoreDuplication(duplication: DuplicationSummary): DimensionScore {
  const percentage = duplication.duplicationPercentage;
  const score = percentage <= 5 ? 100 : percentage <= 15 ? 70 : percentage <= 30 ? 40 : 10;
  const reasons = [`${percentage.toFixed(1)}% duplication`];

  if (duplication.isPartial) {
    reasons.push('duplication data may be partial');
  }

  return {
    score,
    weight: WEIGHT,
    label: score >= 80 ? 'healthy' : score >= 50 ? 'warning' : 'critical',
    reasons
  };
}
