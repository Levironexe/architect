import { readFileSync } from 'node:fs';
import { analyzeDependencyGraph, buildDependencyGraphFromImports } from '../analyzers/dependency-graph.js';
import { analyzeDuplication } from '../analyzers/duplication.js';
import { analyzeSecurityPatterns } from '../analyzers/security-check.js';
import { analyzeDeadCode } from '../analyzers/dead-code.js';
import { discoverFiles, discoverSkippedInputs } from '../analyzers/file-walker.js';
import { analyzeFileByLanguage } from '../analyzers/language-analyzer.js';
import { buildIssues, createReportGuidance } from '../scoring/issue-builder.js';
import { calculateHealthScore, clampScore } from '../scoring/health-score.js';
import { scoreDuplication } from '../scoring/duplication-score.js';
import { scoreModularity } from '../scoring/modularity-score.js';
import { collectProjectCharacteristics, collectProjectCharacteristicsFromLanguage, detectSkills } from '../skills/detector.js';
import { loadSkills } from '../skills/loader.js';
import { compareStructure } from '../skills/structure-check.js';
import { createEmptySummary, type FileAnalysis, type ParseError, type ScanResult } from '../types/analysis.js';
import type { ScanDiagnostic, ScanThresholds, ScanWarning, SkippedInput } from '../types/scan-output.js';
import { ensureDirectoryPath } from '../utils/path.js';
import { createProgressDiagnostics, createThresholdDiagnostics } from '../utils/progress.js';
import { DEFAULT_SCAN_THRESHOLDS } from '../utils/thresholds.js';
import { detectLanguage, type DetectedLanguage } from '../languages/registry.js';
import { runLiteScan } from './lite-scan-runner.js';

export type ProjectScanOptions = {
  json?: boolean;
  verbose?: boolean;
  thresholds?: ScanThresholds;
};

interface AnalysisSet {
  files: FileAnalysis[];
  parseErrors: ParseError[];
}

export async function runProjectScan(directory: string, options: ProjectScanOptions = {}): Promise<ScanResult> {
  const detected = await detectLanguage(directory);
  if (detected?.config.supportsScanning === 'lite') {
    return runLiteScan(directory, detected, options);
  }

  const targetDirectory = ensureDirectoryPath(directory);
  const startedAt = Date.now();
  const thresholds = options.thresholds ?? DEFAULT_SCAN_THRESHOLDS;
  const isJavaScript = !detected || detected.config.id === 'javascript';
  const extensions = isJavaScript ? undefined : detected!.config.extensions;
  const discoveredFiles = await discoverFiles(targetDirectory, extensions);
  const skippedInputs = await discoverSkippedInputs(targetDirectory, extensions);
  const languageId = detected?.config.id ?? 'javascript';
  const analysis = await analyzeFiles(discoveredFiles, targetDirectory, languageId, thresholds);

  const dependencyGraph = isJavaScript
    ? await analyzeDependencyGraph(targetDirectory, analysis.files, analysis.parseErrors)
    : buildDependencyGraphFromImports(analysis.files, detected!.config.extensions);
  const duplication = await analyzeDuplication(targetDirectory, analysis.files, analysis.parseErrors);
  const result = buildScanResult(targetDirectory, analysis.files, analysis.parseErrors, dependencyGraph, duplication, Date.now() - startedAt);

  result.skippedInputs = skippedInputs;
  result.diagnostics = createInitialDiagnostics(thresholds, discoveredFiles.length, options.verbose === true, skippedInputs);

  if (isJavaScript) {
    await attachSkillContext(result, targetDirectory, discoveredFiles, analysis.files);
  } else {
    await attachNonJsSkillContext(result, targetDirectory, detected!);
  }

  const sourceContents = readSourceContents(analysis.files);
  result.security = analyzeSecurityPatterns(analysis.files, sourceContents);
  result.deadCode = analyzeDeadCode(analysis.files, result.dependencyGraph);

  attachScoresAndGuidance(result, analysis.files, duplication, result.security);
  result.warnings = buildScanWarnings(result);
  result.diagnostics = [...(result.diagnostics ?? []), ...buildScanDiagnostics(result)];
  result.scanTier = 'full';

  return result;
}

async function analyzeFiles(filePaths: string[], targetDirectory: string, languageId: string, thresholds: ScanThresholds): Promise<AnalysisSet> {
  const files: FileAnalysis[] = [];
  const parseErrors: ParseError[] = [];

  for (const filePath of filePaths) {
    try {
      files.push(await analyzeFileByLanguage(filePath, targetDirectory, languageId, thresholds));
    } catch (error) {
      parseErrors.push({
        path: filePath,
        relativePath: filePath.replace(`${targetDirectory}/`, ''),
        error: error instanceof Error ? error.message : 'Unknown parse error'
      });
    }
  }

  return { files, parseErrors };
}

async function attachNonJsSkillContext(
  result: ScanResult,
  targetDirectory: string,
  detected: DetectedLanguage
): Promise<void> {
  const skillLoadResult = await loadSkills();
  const characteristics = await collectProjectCharacteristicsFromLanguage(targetDirectory, detected);
  const languageSkills = skillLoadResult.skills.filter(
    (s) => s.language === detected.config.id || s.language === 'agnostic'
  );
  const matchedSkills = detectSkills(characteristics, languageSkills);

  result.skillLoadWarnings = skillLoadResult.warnings;
  result.matchedSkills = matchedSkills;
  result.structureComparison = await compareStructure(targetDirectory, matchedSkills);
}

function createInitialDiagnostics(thresholds: ScanThresholds, fileCount: number, verbose: boolean, skippedInputs: SkippedInput[]): ScanDiagnostic[] {
  const diagnostics = [
    ...createThresholdDiagnostics(thresholds.locThreshold, thresholds.complexityThreshold),
    ...createProgressDiagnostics(fileCount, verbose)
  ];

  if (skippedInputs.length > 0) {
    diagnostics.push({
      phase: 'discovery',
      message: `${skippedInputs.length} unsupported or ignored input(s) were skipped.`,
      details: {
        skippedCount: skippedInputs.length,
        reasons: skippedInputs.reduce<Record<string, number>>((counts, input) => {
          counts[input.reason] = (counts[input.reason] ?? 0) + 1;
          return counts;
        }, {})
      }
    });
  }

  return diagnostics;
}

async function attachSkillContext(result: ScanResult, targetDirectory: string, discoveredFiles: string[], files: FileAnalysis[]): Promise<void> {
  const skillLoadResult = await loadSkills();
  const characteristics = await collectProjectCharacteristics(targetDirectory, discoveredFiles, files);
  const matchedSkills = detectSkills(characteristics, skillLoadResult.skills);

  result.skillLoadWarnings = skillLoadResult.warnings;
  result.matchedSkills = matchedSkills;
  result.structureComparison = await compareStructure(targetDirectory, matchedSkills);
}

function readSourceContents(files: FileAnalysis[]): Map<string, string> {
  const contents = new Map<string, string>();
  for (const file of files) {
    try {
      contents.set(file.path, readFileSync(file.path, 'utf-8'));
    } catch {
      // skip unreadable files
    }
  }
  return contents;
}

function attachScoresAndGuidance(result: ScanResult, files: FileAnalysis[], duplication: ScanResult['duplication'], security?: import('../types/security.js').SecuritySummary): void {
  const modularityScore = scoreModularity(files);
  const duplicationScore = scoreDuplication(duplication);

  const scores = calculateHealthScore(modularityScore, duplicationScore);
  if (security && security.criticalCount > 0) {
    scores.overall = clampScore(scores.overall - security.criticalCount * 5);
  }
  result.scores = scores;
  result.issues = buildIssues(result);
  result.guidance = createReportGuidance(result);
}

function buildScanWarnings(result: ScanResult): ScanWarning[] {
  const warnings: ScanWarning[] = [
    ...result.parseErrors.map((error) => ({
      code: 'parse_error',
      path: error.relativePath,
      message: `Failed to parse ${error.relativePath}: ${error.error}`
    })),
    ...(result.skillLoadWarnings ?? []).map((warning) => ({
      code: 'invalid_skill',
      path: warning.file,
      message: warning.message
    }))
  ];

  if ((result.dependencyGraph.isPartial || result.duplication.isPartial) && result.summary.skippedFiles > 0) {
    warnings.push({
      code: 'partial_analysis',
      message: `Dependency and duplication findings may be partial because ${result.summary.skippedFiles} file(s) were skipped.`
    });
  }

  return warnings;
}

function buildScanDiagnostics(result: ScanResult): ScanDiagnostic[] {
  const diagnostics: ScanDiagnostic[] = [];

  if (result.scores?.overall !== undefined && result.scores.overall <= 0) {
    diagnostics.push({
      phase: 'scoring',
      message: 'Health score could not be computed.',
      details: {}
    });
  }

  return diagnostics;
}

function buildScanResult(
  targetDirectory: string,
  files: FileAnalysis[],
  parseErrors: ParseError[],
  dependencyGraph: ScanResult['dependencyGraph'],
  duplication: ScanResult['duplication'],
  scanDurationMs: number
): ScanResult {
  const summary = createEmptySummary(targetDirectory);

  summary.totalFiles = files.length;
  summary.skippedFiles = parseErrors.length;
  summary.totalLoc = files.reduce((total, file) => total + file.loc, 0);
  summary.totalLines = files.reduce((total, file) => total + file.totalLines, 0);
  summary.flaggedFiles = files.filter((file) => file.isOversized).length;
  summary.flaggedFunctions = files.reduce((total, file) => total + file.functions.filter((item) => item.isFlagged).length, 0);
  summary.dependencyHotspots = dependencyGraph.hotspots.length + (dependencyGraph.exportHubs?.length ?? 0);
  summary.circularDependencies = dependencyGraph.circularDependencies.length;
  summary.duplicateFindings = duplication.findings.length;
  summary.duplicatedLines = duplication.duplicatedLines;
  summary.scanDurationMs = scanDurationMs;

  return { summary, files, parseErrors, dependencyGraph, duplication };
}
