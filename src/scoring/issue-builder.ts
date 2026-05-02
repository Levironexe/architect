import type { ScanResult } from '../types/analysis.js';
import type { ReportGuidance, ReportIssue } from '../types/issue.js';

const SEVERITY_ORDER: Record<ReportIssue['severity'], number> = {
  critical: 0,
  warning: 1,
  info: 2
};

export function buildIssues(result: ScanResult): ReportIssue[] {
  const issues: ReportIssue[] = [];

  for (const file of result.files) {
    if (file.isOversized) {
      issues.push({
        severity: 'critical',
        category: 'modularity',
        location: file.relativePath,
        message: `${file.relativePath} is oversized at ${file.loc} LOC.`,
        suggestion: 'Split this file around its dominant responsibilities before adding more features.'
      });
    }

    for (const fn of file.functions.filter((item) => item.isFlagged)) {
      issues.push({
        severity: 'warning',
        category: 'complexity',
        location: `${file.relativePath} :: ${fn.name}`,
        message: `${fn.name} has high complexity (${fn.complexity}).`,
        suggestion: 'Extract smaller functions or simplify branching logic.'
      });
    }
  }

  for (const classification of result.classifications ?? []) {
    if (classification.mixedConcerns) {
      issues.push({
        severity: 'critical',
        category: 'separation',
        location: classification.file,
        message: `${classification.file} mixes three or more concerns.`,
        suggestion: 'Split routing, validation, data access, and business logic into separate architectural areas.'
      });
    }
  }

  for (const finding of result.patternFindings ?? []) {
    if (finding.confidence !== 'insufficient' && finding.deviations.length > 0) {
      issues.push({
        severity: finding.patternCount >= 3 ? 'critical' : 'warning',
        category: 'consistency',
        location: finding.concern,
        message: `${finding.concern} uses ${finding.patternCount} competing patterns.`,
        suggestion: `Converge deviations toward the dominant ${finding.dominantPattern ?? 'detected'} pattern.`
      });
    }
  }

  if ((result.duplication.duplicationPercentage ?? 0) > 15) {
    issues.push({
      severity: result.duplication.duplicationPercentage > 30 ? 'critical' : 'warning',
      category: 'duplication',
      message: `${result.duplication.duplicationPercentage.toFixed(1)}% duplicated code detected.`,
      suggestion: 'Consolidate duplicated blocks behind shared helpers or services.'
    });
  }

  for (const hotspot of result.dependencyGraph.hotspots) {
    issues.push({
      severity: 'warning',
      category: 'dependency',
      location: hotspot.relativePath,
      message: `${hotspot.relativePath} is depended on by ${hotspot.dependentCount} files.`,
      suggestion: 'Review whether this module has too many responsibilities.'
    });
  }

  return issues.sort(compareIssues);
}

export function createReportGuidance(result: ScanResult): ReportGuidance {
  const hasCritical = (result.issues ?? []).some((issue) => issue.severity === 'critical');

  return {
    message: hasCritical
      ? 'Critical structural issues found. Generate a refactoring roadmap before adding features.'
      : 'Use the health report to guide the next refactoring pass.',
    command: 'architect plan'
  };
}

function compareIssues(left: ReportIssue, right: ReportIssue): number {
  return (
    SEVERITY_ORDER[left.severity] - SEVERITY_ORDER[right.severity]
    || left.category.localeCompare(right.category)
    || (left.location ?? '').localeCompare(right.location ?? '')
    || left.message.localeCompare(right.message)
  );
}
