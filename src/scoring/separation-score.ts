import type { ConcernClassification } from '../types/concern.js';
import type { DimensionScore } from '../types/scoring.js';
import { clampScore, labelForScore } from './health-score.js';

const WEIGHT = 30;

export function scoreSeparation(classifications: ConcernClassification[] | undefined): DimensionScore | null {
  if (!classifications || classifications.length === 0) {
    return null;
  }

  let warningFiles = 0;
  let criticalFiles = 0;

  for (const classification of classifications) {
    const concernCount = new Set(
      classification.functions.map((fn) => fn.concern).filter((concern) => concern !== 'unclassified')
    ).size;

    if (concernCount >= 3) {
      criticalFiles += 1;
    } else if (concernCount === 2) {
      warningFiles += 1;
    }
  }

  const fileCount = Math.max(classifications.length, 1);
  const penalty = (warningFiles / fileCount) * 35 + (criticalFiles / fileCount) * 70;
  const score = clampScore(100 - penalty);
  const reasons: string[] = [];

  if (warningFiles > 0) {
    reasons.push(`${warningFiles} file(s) contain two concerns`);
  }

  if (criticalFiles > 0) {
    reasons.push(`${criticalFiles} file(s) contain three or more concerns`);
  }

  return {
    score,
    weight: WEIGHT,
    label: labelForScore(score),
    reasons: reasons.length > 0 ? reasons : ['Files keep concerns separated']
  };
}
