import type { ConcernClassification, ConcernType } from '../types/concern.js';
import type { PatternFinding } from '../types/pattern.js';

const MIN_EVIDENCE = 2;

export function analyzePatterns(classifications: ConcernClassification[] | undefined): PatternFinding[] {
  if (!classifications || classifications.length === 0) {
    return [];
  }

  const grouped = new Map<ConcernType, { location: string; pattern: string }[]>();

  for (const classification of classifications) {
    for (const fn of classification.functions) {
      if (fn.concern === 'unclassified') {
        continue;
      }

      const items = grouped.get(fn.concern) ?? [];
      items.push({
        location: `${classification.file} :: ${fn.name}`,
        pattern: inferPattern(classification.file, fn.name)
      });
      grouped.set(fn.concern, items);
    }
  }

  return Array.from(grouped.entries()).map(([concern, items]) => createFinding(concern, items));
}

function createFinding(concern: ConcernType, items: { location: string; pattern: string }[]): PatternFinding {
  if (items.length < MIN_EVIDENCE) {
    return {
      concern,
      dominantPattern: null,
      patternCount: 0,
      deviations: [],
      confidence: 'insufficient',
      reason: 'Insufficient evidence to infer a dominant pattern'
    };
  }

  const counts = new Map<string, number>();

  for (const item of items) {
    counts.set(item.pattern, (counts.get(item.pattern) ?? 0) + 1);
  }

  const sorted = Array.from(counts.entries()).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
  const dominantPattern = sorted[0]?.[0] ?? 'unknown';
  const deviations = items
    .filter((item) => item.pattern !== dominantPattern)
    .map((item) => ({
      location: item.location,
      pattern: item.pattern,
      expectedPattern: dominantPattern
    }));

  return {
    concern,
    dominantPattern,
    patternCount: counts.size,
    deviations,
    confidence: counts.size === 1 ? 'high' : counts.size === 2 ? 'medium' : 'low',
    reason: counts.size === 1 ? `Consistent ${dominantPattern} pattern` : `${counts.size} patterns detected for ${concern}`
  };
}

function inferPattern(filePath: string, functionName: string): string {
  const normalized = `${filePath}/${functionName}`.toLowerCase();

  if (normalized.includes('controller')) {
    return 'controller';
  }

  if (normalized.includes('route')) {
    return 'route-handler';
  }

  if (normalized.includes('service')) {
    return 'service';
  }

  if (normalized.includes('model') || normalized.includes('repository') || normalized.includes('find') || normalized.includes('create')) {
    return 'repository';
  }

  if (normalized.includes('schema') || normalized.includes('valid')) {
    return 'schema-validation';
  }

  return 'inline';
}
