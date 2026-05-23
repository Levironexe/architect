import type { DuplicationSummary } from '../types/analysis.js';
import type { DimensionScore } from '../types/scoring.js';

const WEIGHT = 20;

export function scoreDuplication(duplication: DuplicationSummary): DimensionScore {
  const percentage = duplication.duplicationPercentage;
  const score = percentage <= 5 ? 100 : percentage <= 10 ? 80 : percentage <= 20 ? 65 : percentage <= 35 ? 45 : percentage <= 50 ? 30 : 15;
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
