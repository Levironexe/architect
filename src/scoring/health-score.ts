import type { DimensionScore, FullScoreBreakdown, HealthLabel, ScoreBreakdown, ScoreDimension, ScoreDimensionId } from '../types/scoring.js';

export function calculatePartialHealthScore(modularity: DimensionScore, duplication: DimensionScore): ScoreBreakdown {
  const availableWeight = modularity.weight + duplication.weight;
  const weightedScore = (modularity.score * modularity.weight + duplication.score * duplication.weight) / availableWeight;

  return {
    modularity,
    duplication,
    partialHealthScore: Math.round(weightedScore),
    availableWeight
  };
}

export function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function labelForScore(score: number): Exclude<HealthLabel, 'unavailable'> {
  if (score >= 80) {
    return 'healthy';
  }

  if (score >= 50) {
    return 'warning';
  }

  return 'critical';
}

export function toScoreDimension(id: ScoreDimensionId, dimension: DimensionScore): ScoreDimension {
  return {
    id,
    score: dimension.score,
    weight: dimension.weight,
    label: dimension.label,
    state: 'available',
    reasons: dimension.reasons
  };
}

export function unavailableDimension(id: ScoreDimensionId, weight: number, reason: string): ScoreDimension {
  return {
    id,
    score: null,
    weight,
    label: 'unavailable',
    state: 'unavailable',
    reasons: [reason]
  };
}

export function calculateHealthScore(dimensions: {
  separation: ScoreDimension;
  consistency: ScoreDimension;
  modularity: ScoreDimension;
  duplication: ScoreDimension;
}): FullScoreBreakdown {
  const entries = Object.values(dimensions);
  const available = entries.filter((dimension) => dimension.score !== null);
  const totalWeight = entries.reduce((total, dimension) => total + dimension.weight, 0);
  const availableWeight = available.reduce((total, dimension) => total + dimension.weight, 0);

  if (available.length === 0 || availableWeight === 0) {
    return {
      health: {
        score: null,
        label: 'unavailable',
        state: 'unavailable',
        availableWeight,
        totalWeight,
        reasons: ['No scoring dimensions were available']
      },
      dimensions
    };
  }

  const score = clampScore(
    available.reduce((total, dimension) => total + (dimension.score ?? 0) * dimension.weight, 0) / availableWeight
  );
  const unavailable = entries.filter((dimension) => dimension.score === null);

  return {
    health: {
      score,
      label: labelForScore(score),
      state: unavailable.length > 0 ? 'partial' : 'complete',
      availableWeight,
      totalWeight,
      reasons: unavailable.map((dimension) => `${dimension.id} unavailable`)
    },
    dimensions
  };
}
