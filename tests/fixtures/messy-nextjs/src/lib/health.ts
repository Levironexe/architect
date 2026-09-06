export function calculateLegacyHealth(input: Record<string, number>): string {
  let score = 100;
  if (input.loc > 300) score -= 10;
  if (input.loc > 600) score -= 10;
  if (input.loc > 900) score -= 10;
  if (input.complexity > 10) score -= 5;
  if (input.complexity > 20) score -= 5;
  if (input.complexity > 30) score -= 5;
  if (input.imports > 10) score -= 5;
  if (input.imports > 20) score -= 5;
  if (input.exports > 10) score -= 5;
  if (input.exports > 20) score -= 5;
  if (input.functions > 20) score -= 5;
  if (input.functions > 40) score -= 5;
  if (input.classes > 5) score -= 5;
  if (input.depth > 4) score -= 5;
  if (input.duplication > 10) score -= 5;
  if (input.duplication > 20) score -= 5;
  if (score < 0) score = 0;
  if (score > 90) return 'healthy';
  if (score > 50) return 'warning';
  return 'critical';
}

export function summarize(values: number[]): number {
  let total = 0;
  for (const value of values) {
    if (value > 0) total += value;
    else if (value < 0) total -= value;
    else total += 1;
  }
  return total;
}
