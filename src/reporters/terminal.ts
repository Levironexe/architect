import path from 'node:path';

import { Chalk } from 'chalk';

import { createEmptyDependencyGraphSummary, createEmptyDuplicationSummary, type DuplicationFinding, type FileAnalysis, type FunctionInfo, type ScanResult } from '../types/analysis.js';

export function renderDiscoveryReport(targetDirectory: string, files: string[]): void {
  if (files.length === 0) {
    process.stdout.write(`No supported JS/TS files found in ${targetDirectory}\n`);
    return;
  }

  process.stdout.write(`Architect scan: ${targetDirectory}\n\n`);

  for (const filePath of files) {
    process.stdout.write(`${path.relative(targetDirectory, filePath)}\n`);
  }
}

export function renderScanReport(result: ScanResult, options: { color?: boolean } = {}): void {
  const chalk = new Chalk({ level: options.color === false ? 0 : 1 });
  const dependencyGraph = result.dependencyGraph ?? createEmptyDependencyGraphSummary(false);
  const duplication = result.duplication ?? createEmptyDuplicationSummary(false);
  const dependencyHotspots = result.summary.dependencyHotspots ?? 0;
  const circularDependencies = result.summary.circularDependencies ?? 0;
  const duplicateFindings = result.summary.duplicateFindings ?? 0;
  const duplicatedLines = result.summary.duplicatedLines ?? 0;

  if (result.files.length === 0 && result.parseErrors.length === 0) {
    process.stdout.write(`No supported JS/TS files found in ${result.summary.targetDir}\n`);
    return;
  }

  process.stdout.write(`Architect scan: ${result.summary.targetDir}\n\n`);
  renderProjectOverview(result);
  renderDetectedArchitecture(result);
  renderStructureComparison(result);
  renderConcernClassification(result);
  renderPatternFindings(result);
  process.stdout.write(`${pad('FILE', 28)} ${pad('LOC', 5)} ${pad('FN', 4)} ${pad('CL', 4)} ${pad('IMP', 5)} ${pad('EXP', 5)} STATUS\n`);

  for (const file of result.files) {
    const status = formatStatus(file, chalk);
    process.stdout.write(
      `${pad(file.relativePath, 28)} ${pad(String(file.loc), 5)} ${pad(String(file.functions.length), 4)} ${pad(String(file.classes.length), 4)} ${pad(String(file.imports.length), 5)} ${pad(String(file.exports.length), 5)} ${status}\n`
    );
  }

  const flaggedFunctions = result.files.flatMap((file: FileAnalysis) =>
    file.functions
      .filter((item: FunctionInfo) => item.isFlagged)
      .map((item: FunctionInfo) => `${file.relativePath} :: ${item.name} (complexity ${item.complexity})`)
  );

  if (flaggedFunctions.length > 0) {
    process.stdout.write(`\nCritical functions:\n`);

    for (const entry of flaggedFunctions) {
      process.stdout.write(`- ${entry}\n`);
    }
  }

  process.stdout.write(`\nDependency insights:\n`);

  if (dependencyGraph.hotspots.length > 0) {
    for (const hotspot of dependencyGraph.hotspots) {
      process.stdout.write(`- Hotspot: ${hotspot.relativePath} (depended on by ${hotspot.dependentCount} files)\n`);
    }
  }

  if (dependencyGraph.circularDependencies.length > 0) {
    for (const cycle of dependencyGraph.circularDependencies) {
      process.stdout.write(`- Circular dependency: ${cycle.files.join(' -> ')}\n`);
    }
  }

  if (dependencyGraph.unreferencedFiles.length > 0) {
    for (const filePath of dependencyGraph.unreferencedFiles) {
      process.stdout.write(`- Unreferenced: ${filePath}\n`);
    }
  }

  if (
    dependencyGraph.hotspots.length === 0
    && dependencyGraph.circularDependencies.length === 0
    && dependencyGraph.unreferencedFiles.length === 0
  ) {
    process.stdout.write(`- No dependency risks detected\n`);
  }

  process.stdout.write(`\nDuplication findings:\n`);

  if (duplication.findings.length > 0) {
    for (const finding of duplication.findings) {
      process.stdout.write(`- ${formatDuplicationFinding(finding)}\n`);
    }
  } else {
    process.stdout.write(`- No significant duplication findings detected\n`);
  }

  renderHealthReport(result);
  renderIssues(result);
  renderGuidance(result);

  process.stdout.write(`\nSummary:\n`);
  process.stdout.write(`- Files scanned: ${result.summary.totalFiles}\n`);
  process.stdout.write(`- Total LOC: ${result.summary.totalLoc}\n`);
  process.stdout.write(`- Flagged files: ${result.summary.flaggedFiles}\n`);
  process.stdout.write(`- Flagged functions: ${result.summary.flaggedFunctions}\n`);
  process.stdout.write(`- Dependency hotspots: ${dependencyHotspots}\n`);
  process.stdout.write(`- Circular dependencies: ${circularDependencies}\n`);
  process.stdout.write(`- Duplicate findings: ${duplicateFindings}\n`);
  process.stdout.write(`- Duplicated lines: ${duplicatedLines}\n`);
  process.stdout.write(`- Skipped files: ${result.summary.skippedFiles}\n`);

  if (
    result.summary.flaggedFiles === 0
    && result.summary.flaggedFunctions === 0
    && dependencyHotspots === 0
    && circularDependencies === 0
    && duplicateFindings === 0
  ) {
    process.stdout.write(`- No critical findings detected\n`);
  }

  for (const parseError of result.parseErrors) {
    process.stderr.write(`WARN  Failed to parse ${parseError.relativePath}: ${parseError.error}\n`);
  }

  for (const warning of result.skillLoadWarnings ?? []) {
    process.stderr.write(`WARN  Ignored invalid architecture skill ${warning.file}: ${warning.message}\n`);
  }

  if (result.classificationStatus?.mode !== 'skipped') {
    for (const warning of result.classificationStatus?.warnings ?? []) {
      process.stderr.write(`WARN  AI concern classification: ${warning}\n`);
    }
  }

  if ((dependencyGraph.isPartial || duplication.isPartial) && result.summary.skippedFiles > 0) {
    const noun = result.summary.skippedFiles === 1 ? 'file was' : 'files were';
    process.stderr.write(`WARN  Dependency and duplication findings may be partial because ${result.summary.skippedFiles} ${noun} skipped\n`);
  }
}

function renderProjectOverview(result: ScanResult): void {
  process.stdout.write(`Project overview:\n`);
  process.stdout.write(`- Files scanned: ${result.summary.totalFiles}\n`);
  process.stdout.write(`- Total LOC: ${result.summary.totalLoc}\n`);
  process.stdout.write(`- Languages: ${formatLanguages(result.files)}\n\n`);
}

function renderDetectedArchitecture(result: ScanResult): void {
  const matches = result.matchedSkills ?? [];
  const primary = matches.find((match) => match.primary);
  const secondary = matches.filter((match) => !match.primary);

  process.stdout.write(`Detected architecture:\n`);

  if (primary) {
    process.stdout.write(`- Primary: ${primary.skill.name} (${primary.skill.id}) [${primary.confidence} confidence]\n`);
  } else {
    process.stdout.write(`- No confident primary architecture skill detected\n`);
  }

  for (const match of secondary) {
    process.stdout.write(`- Secondary: ${match.skill.name} (${match.skill.id})\n`);
  }

  process.stdout.write(`\n`);
}

function renderStructureComparison(result: ScanResult): void {
  const comparison = result.structureComparison;

  process.stdout.write(`Structure comparison:\n`);

  if (!comparison?.isAvailable) {
    process.stdout.write(`- Unavailable because no primary architecture skill was detected\n\n`);
    return;
  }

  if (comparison.entries.length === 0) {
    process.stdout.write(`- No expected structural areas declared by ${comparison.skillId}\n\n`);
    return;
  }

  for (const entry of comparison.entries) {
    process.stdout.write(`- ${pad(entry.status, 8)} ${pad(entry.path, 18)} ${entry.purpose}\n`);
  }

  process.stdout.write(`\n`);
}

function renderConcernClassification(result: ScanResult): void {
  const status = result.classificationStatus;

  process.stdout.write(`Concern classification:\n`);

  if (!status) {
    process.stdout.write(`- Unavailable\n\n`);
    return;
  }

  if (status.mode === 'skipped') {
    process.stdout.write(`- Skipped: ${status.reason ?? 'AI provider was not configured.'}\n\n`);
    return;
  }

  if (status.mode === 'failed') {
    process.stdout.write(`- Failed${status.provider ? ` via ${status.provider}` : ''}: ${status.reason ?? 'Provider failed.'}\n\n`);
    return;
  }

  process.stdout.write(`- ${status.mode === 'completed' ? 'Completed' : 'Partially completed'} via ${status.provider ?? 'AI provider'}\n`);

  const mixedFiles = (result.classifications ?? []).filter((classification) => classification.mixedConcerns);
  const misplaced = (result.classifications ?? []).flatMap((classification) =>
    classification.functions
      .filter((fn) => fn.isMisplaced)
      .map((fn) => `${classification.file} :: ${fn.name} (${fn.concern})${fn.reason ? ` - ${fn.reason}` : ''}`)
  );

  if (mixedFiles.length > 0) {
    process.stdout.write(`- Mixed-concern files: ${mixedFiles.map((item) => item.file).join(', ')}\n`);
  }

  if (misplaced.length > 0) {
    process.stdout.write(`- Misplaced functions:\n`);

    for (const entry of misplaced) {
      process.stdout.write(`  - ${entry}\n`);
    }
  }

  if (mixedFiles.length === 0 && misplaced.length === 0) {
    process.stdout.write(`- No mixed-concern files or misplaced functions reported\n`);
  }

  process.stdout.write(`\n`);
}

function renderPatternFindings(result: ScanResult): void {
  const findings = result.patternFindings ?? [];

  process.stdout.write(`Pattern consistency:\n`);

  if (findings.length === 0) {
    process.stdout.write(`- Unavailable because no concern classifications were available\n\n`);
    return;
  }

  for (const finding of findings) {
    if (finding.confidence === 'insufficient') {
      process.stdout.write(`- ${finding.concern}: insufficient evidence\n`);
      continue;
    }

    process.stdout.write(
      `- ${finding.concern}: ${finding.patternCount} pattern(s), dominant ${finding.dominantPattern ?? 'unknown'}`
    );

    if (finding.deviations.length > 0) {
      process.stdout.write(`, ${finding.deviations.length} deviation(s)`);
    }

    process.stdout.write(`\n`);
  }

  process.stdout.write(`\n`);
}

function renderHealthReport(result: ScanResult): void {
  process.stdout.write(`\nHealth report:\n`);

  if (!result.health || !result.dimensions) {
    renderLegacyPartialHealthScore(result);
    return;
  }

  const score = result.health.score === null ? 'unavailable' : String(result.health.score);
  process.stdout.write(`- Overall score: ${score} ${result.health.label} (${result.health.state})\n`);
  process.stdout.write(`- Available weight: ${result.health.availableWeight}/${result.health.totalWeight}\n`);
  process.stdout.write(`- Dimensions:\n`);

  for (const dimension of Object.values(result.dimensions)) {
    const dimensionScore = dimension.score === null ? 'unavailable' : String(dimension.score);
    process.stdout.write(`  - ${dimension.id}: ${dimensionScore} ${dimension.label} (${dimension.state}) - ${dimension.reasons.join('; ')}\n`);
  }
}

function renderIssues(result: ScanResult): void {
  const issues = result.issues ?? [];

  process.stdout.write(`\nRanked issues:\n`);

  if (issues.length === 0) {
    process.stdout.write(`- No ranked structural issues detected\n`);
    return;
  }

  for (const issue of issues) {
    const location = issue.location ? ` [${issue.location}]` : '';
    process.stdout.write(`- ${issue.severity.toUpperCase()} ${issue.category}${location}: ${issue.message} ${issue.suggestion}\n`);
  }
}

function renderGuidance(result: ScanResult): void {
  const guidance = result.guidance;

  if (!guidance) {
    return;
  }

  process.stdout.write(`\nNext step:\n`);
  process.stdout.write(`- ${guidance.message}`);

  if (guidance.command) {
    process.stdout.write(` Run \`${guidance.command}\` to generate a refactoring roadmap.`);
  }

  process.stdout.write(`\n`);
}

function renderLegacyPartialHealthScore(result: ScanResult): void {
  const scores = result.scores;

  if (!scores) {
    process.stdout.write(`- Unavailable\n`);
    return;
  }

  process.stdout.write(`- Partial score: ${scores.partialHealthScore}\n`);
  process.stdout.write(`- Modularity: ${scores.modularity.score} ${scores.modularity.label}\n`);
  process.stdout.write(`- Duplication: ${scores.duplication.score} ${scores.duplication.label}\n`);
}

function formatDuplicationFinding(finding: DuplicationFinding): string {
  const [left, right] = finding.occurrences;
  return `Duplicate block (${finding.duplicatedLines} lines): ${left?.relativePath}:${left?.startLine}-${left?.endLine} <-> ${right?.relativePath}:${right?.startLine}-${right?.endLine}`;
}

function formatStatus(file: FileAnalysis, chalk: { red: (value: string) => string; yellow: (value: string) => string; green: (value: string) => string }): string {
  if (file.isOversized) {
    return chalk.red('OVERSIZED');
  }

  if (file.hasCriticalComplexity) {
    return chalk.yellow('COMPLEX');
  }

  return chalk.green('OK');
}

function pad(value: string, width: number): string {
  return value.length >= width ? value.slice(0, width) : value.padEnd(width, ' ');
}

function formatLanguages(files: FileAnalysis[]): string {
  const extensions = new Set(files.map((file) => path.extname(file.relativePath)));
  const labels: string[] = [];

  if (extensions.has('.ts') || extensions.has('.tsx')) {
    labels.push('TypeScript');
  }

  if (extensions.has('.js') || extensions.has('.jsx')) {
    labels.push('JavaScript');
  }

  return labels.length > 0 ? labels.join(', ') : 'Unknown';
}
