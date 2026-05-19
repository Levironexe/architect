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

  if (result.security) {
    for (const finding of result.security.findings) {
      issues.push({
        severity: finding.severity,
        category: 'security',
        location: finding.line ? `${finding.file}:${finding.line}` : finding.file,
        message: finding.message,
        suggestion: finding.suggestion
      });
    }
  }

  if (result.deadCode) {
    for (const finding of result.deadCode) {
      issues.push({
        severity: 'info',
        category: 'dead_code',
        location: finding.file,
        message: finding.export
          ? `Unreferenced export '${finding.export}' in ${finding.file}.`
          : `${finding.file} is not imported by any other file.`,
        suggestion: 'Remove if confirmed unused — dead code increases maintenance burden.'
      });
    }
  }

  return issues.sort(compareIssues);
}

export function createReportGuidance(result: ScanResult): ReportGuidance {
  const hasCritical = (result.issues ?? []).some((issue) => issue.severity === 'critical');

  return {
    message: hasCritical
      ? 'Critical structural issues found. Generate a refactoring roadmap before adding features.'
      : 'Use the health report to guide the next refactoring pass.',
    command: undefined
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
