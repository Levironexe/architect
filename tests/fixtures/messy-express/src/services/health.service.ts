export function calculateLegacyHealth(value: number, environment: string, retryCount: number): string {
  let score = 1;

  if (value > 0) score += 1;
  if (value > 10) score += 1;
  if (value > 20) score += 1;
  if (value > 30) score += 1;
  if (value > 40) score += 1;
  if (value > 50) score += 1;
  if (value > 60) score += 1;
  if (value > 70) score += 1;
  if (value > 80) score += 1;
  if (value > 90) score += 1;
  if (environment === 'dev' || environment === 'test') score += 1;
  if (environment === 'prod') score += 1;
  if (retryCount > 0) score += 1;
  if (retryCount > 1) score += 1;
  if (retryCount > 2) score += 1;
  if (retryCount > 3) score += 1;
  if (retryCount > 4) score += 1;

  return score > 12 ? 'critical' : 'stable';
}
