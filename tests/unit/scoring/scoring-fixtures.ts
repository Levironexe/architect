import type { ConcernClassification, ConcernType } from '../../../src/types/concern';
import type { PatternFinding } from '../../../src/types/pattern';
import type { ScoreDimension } from '../../../src/types/scoring';

export function classification(file: string, concerns: ConcernType[]): ConcernClassification {
  const unique = new Set(concerns.filter((concern) => concern !== 'unclassified'));

  return {
    file,
    dominantConcern: concerns.find((concern) => concern !== 'unclassified') ?? 'unclassified',
    mixedConcerns: unique.size >= 3,
    warnings: [],
    functions: concerns.map((concern, index) => ({
      name: `fn${index}`,
      concern,
      confidence: 0.9,
      isMisplaced: false
    }))
  };
}

export function dimension(
  id: ScoreDimension['id'],
  score: number | null,
  weight: number,
  state: ScoreDimension['state'] = score === null ? 'unavailable' : 'available'
): ScoreDimension {
  return {
    id,
    score,
    weight,
    state,
    label: score === null ? 'unavailable' : score >= 80 ? 'healthy' : score >= 50 ? 'warning' : 'critical',
    reasons: score === null ? [`${id} unavailable`] : [`${id} score ${score}`]
  };
}

export function patternFinding(patternCount: number, deviationCount = Math.max(0, patternCount - 1)): PatternFinding {
  return {
    concern: 'data_access',
    dominantPattern: patternCount > 0 ? 'repository' : null,
    patternCount,
    deviations: Array.from({ length: deviationCount }, (_, index) => ({
      location: `src/file-${index}.ts`,
      pattern: `pattern-${index}`,
      expectedPattern: 'repository'
    })),
    confidence: patternCount === 0 ? 'insufficient' : patternCount === 1 ? 'high' : 'medium',
    reason: patternCount === 0 ? 'Insufficient evidence' : `${patternCount} pattern(s) detected`
  };
}

export const patternFixtures = {
  single: [patternFinding(1, 0)],
  two: [patternFinding(2, 1)],
  three: [patternFinding(3, 2)],
  four: [patternFinding(4, 3)],
  insufficient: [patternFinding(0, 0)]
};
