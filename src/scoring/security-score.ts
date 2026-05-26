import type { SecuritySummary } from '../types/security.js';
import type { DimensionScore } from '../types/scoring.js';

const WEIGHT = 20;

export function scoreSecurityPatterns(security: SecuritySummary | undefined): DimensionScore {
  if (!security) {
    return { score: 100, weight: WEIGHT, label: 'healthy', reasons: ['No security analysis available'] };
  }

  const reasons: string[] = [];
  let score = 100;

  if (security.criticalCount > 0) {
    const penalty = Math.min(50, security.criticalCount * 10);
    score -= penalty;
    reasons.push(`${security.criticalCount} critical finding(s) (hardcoded secrets, missing auth)`);
  }

  if (security.warningCount > 0) {
    const penalty = Math.min(30, security.warningCount * 5);
    score -= penalty;
    reasons.push(`${security.warningCount} warning(s) (weak hash, unguarded routes)`);
  }

  const finalScore = Math.max(0, Math.min(100, Math.round(score)));
  return {
    score: finalScore,
    weight: WEIGHT,
    label: finalScore >= 80 ? 'healthy' : finalScore >= 50 ? 'warning' : 'critical',
    reasons: reasons.length > 0 ? reasons : ['No security issues detected']
  };
}
