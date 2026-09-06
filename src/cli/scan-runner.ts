import { collectProjectCharacteristics, detectSkills } from '../skills/detector.js';
import { buildDependencyGraphFromImports } from '../analyzers/dependency-graph.js';
import { discoverFiles, discoverSkippedInputs } from '../analyzers/file-walker.js';
import { analyzeFileByLanguage } from '../analyzers/language-analyzer.js';
import { buildIssues, createReportGuidance } from '../scoring/issue-builder.js';
import { loadSkills } from '../skills/loader.js';
import { compareStructure } from '../skills/structure-check.js';
import { createEmptySummary, SUPPORTED_EXTENSIONS, type FileAnalysis, type ParseError, type ScanResult } from '../types/analysis.js';
import type { ScanDiagnostic, ScanThresholds, ScanWarning, SkippedInput } from '../types/scan-output.js';
import { ensureDirectoryPath } from '../utils/path.js';
import { createProgressDiagnostics, createThresholdDiagnostics } from '../utils/progress.js';
import { DEFAULT_SCAN_THRESHOLDS } from '../utils/thresholds.js';
import { detectLanguage } from '../languages/registry.js';

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
  await detectLanguage(directory);

  const targetDirectory = ensureDirectoryPath(directory);
  const startedAt = Date.now();
  const thresholds = options.thresholds ?? DEFAULT_SCAN_THRESHOLDS;
  const discoveredFiles = await discoverFiles(targetDirectory);
  if (discoveredFiles.length > 5000) {
    process.stderr.write(`WARN  Large project: ${discoveredFiles.length} files discovered. Scan may take a while.\n`);
  }
  const skippedInputs = await discoverSkippedInputs(targetDirectory);
  const analysis = await analyzeFiles(discoveredFiles, targetDirectory, 'javascript', thresholds);

  const dependencyGraph = buildDependencyGraphFromImports(
    analysis.files,
    SUPPORTED_EXTENSIONS.map((extension) => extension.slice(1))
  );
  const result = buildScanResult(targetDirectory, analysis.files, analysis.parseErrors, dependencyGraph, Date.now() - startedAt);

  result.skippedInputs = skippedInputs;
  result.diagnostics = createInitialDiagnostics(thresholds, discoveredFiles.length, options.verbose === true, skippedInputs);

  await attachSkillContext(result, targetDirectory, discoveredFiles, analysis.files);

  attachGuidance(result, analysis.files);
  result.warnings = buildScanWarnings(result);
  result.diagnostics = [...(result.diagnostics ?? []), ...buildScanDiagnostics(result)];

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

function attachGuidance(result: ScanResult, _files: FileAnalysis[]): void {
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

  if (result.dependencyGraph.isPartial && result.summary.skippedFiles > 0) {
    warnings.push({
      code: 'partial_analysis',
      message: `Dependency findings may be partial because ${result.summary.skippedFiles} file(s) were skipped.`
    });
  }

  return warnings;
}

function buildScanDiagnostics(_result: ScanResult): ScanDiagnostic[] {
  return [];
}

function buildScanResult(
  targetDirectory: string,
  files: FileAnalysis[],
  parseErrors: ParseError[],
  dependencyGraph: ScanResult['dependencyGraph'],
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
  summary.scanDurationMs = scanDurationMs;

  return { summary, files, parseErrors, dependencyGraph };
}

