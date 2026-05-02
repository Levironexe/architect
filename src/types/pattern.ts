import type { ConcernType } from './concern.js';

export type PatternConfidence = 'high' | 'medium' | 'low' | 'insufficient';

export interface PatternDeviation {
  location: string;
  pattern: string;
  expectedPattern: string;
}

export interface PatternFinding {
  concern: ConcernType;
  dominantPattern: string | null;
  patternCount: number;
  deviations: PatternDeviation[];
  confidence: PatternConfidence;
  reason: string;
}
