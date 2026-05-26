export type ScoreLabel = 'healthy' | 'warning' | 'critical';
export type HealthLabel = ScoreLabel | 'unavailable';
export type ScoreDimensionId = 'modularity' | 'duplication' | 'security' | 'architecture';

export interface DimensionScore {
  score: number;
  weight: number;
  label: ScoreLabel;
  reasons: string[];
}

export interface ScoreBreakdown {
  modularity: DimensionScore;
  duplication: DimensionScore;
  security?: DimensionScore;
  architecture?: DimensionScore;
  overall: number;
  label: HealthLabel;
  fileSizeDistribution?: DimensionScore;
  tier?: 'lite' | 'full';
}
