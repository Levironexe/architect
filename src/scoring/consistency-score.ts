import type { PatternFinding } from '../types/pattern.js';
import type { DimensionScore } from '../types/scoring.js';
import { clampScore, labelForScore } from './health-score.js';

const WEIGHT = 25;

export function scoreConsistency(findings: PatternFinding[] | undefined): DimensionScore | null {
  const usable = (findings ?? []).filter((finding) => finding.confidence !== 'insufficient');

  if (usable.length === 0) {
    return null;
  }

  const scores = usable.map(scoreFinding);
  const score = clampScore(scores.reduce((total, item) => total + item, 0) / scores.length);
  const reasons = usable.map((finding) => finding.reason);

  return {
    score,
    weight: WEIGHT,
    label: labelForScore(score),
    reasons
  };
}

function scoreFinding(finding: PatternFinding): number {
  const base = finding.patternCount <= 1 ? 100 : finding.patternCount === 2 ? 70 : finding.patternCount === 3 ? 40 : 10;
  const deviationPenalty = Math.min(20, finding.deviations.length * 5);
  return clampScore(base - deviationPenalty);
}
