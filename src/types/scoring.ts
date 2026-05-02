export type ScoreLabel = 'healthy' | 'warning' | 'critical';
export type HealthLabel = ScoreLabel | 'unavailable';
export type ScoreDimensionId = 'separation' | 'consistency' | 'modularity' | 'duplication';
export type ScoreDimensionState = 'available' | 'partial' | 'unavailable';
export type HealthScoreState = 'complete' | 'partial' | 'unavailable';

export interface DimensionScore {
  score: number;
  weight: number;
  label: ScoreLabel;
  reasons: string[];
}

export interface ScoreDimension {
  id: ScoreDimensionId;
  score: number | null;
  weight: number;
  label: HealthLabel;
  state: ScoreDimensionState;
  reasons: string[];
}

export interface HealthScore {
  score: number | null;
  label: HealthLabel;
  state: HealthScoreState;
  availableWeight: number;
  totalWeight: number;
  reasons: string[];
}

export interface FullScoreBreakdown {
  health: HealthScore;
  dimensions: {
    separation: ScoreDimension;
    consistency: ScoreDimension;
    modularity: ScoreDimension;
    duplication: ScoreDimension;
  };
}

export interface ScoreBreakdown {
  modularity: DimensionScore;
  duplication: DimensionScore;
  partialHealthScore: number;
  availableWeight: number;
}
