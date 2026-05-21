import { readFileSync } from 'node:fs';

import { analyzeLiteFile } from '../analyzers/lite-file-analyzer.js';
import { analyzeDuplication } from '../analyzers/duplication.js';
import { analyzeSecurityPatterns } from '../analyzers/security-check.js';
import { discoverFiles, discoverSkippedInputs } from '../analyzers/file-walker.js';
import { buildIssues, createReportGuidance } from '../scoring/issue-builder.js';
import { calculateLiteHealthScore, clampScore } from '../scoring/health-score.js';
import { scoreDuplication } from '../scoring/duplication-score.js';
import { scoreFileSizeDistribution } from '../scoring/file-size-score.js';
import { collectProjectCharacteristicsFromLanguage, detectSkills } from '../skills/detector.js';
import { loadSkills } from '../skills/loader.js';
import { compareStructure } from '../skills/structure-check.js';
import {
  createEmptyDependencyGraphSummary,
  createEmptySummary,
  type FileAnalysis,
  type ScanResult
} from '../types/analysis.js';
import type { ScanDiagnostic } from '../types/scan-output.js';
import type { LanguageConfig, DetectedLanguage } from '../languages/registry.js';
import { ensureDirectoryPath } from '../utils/path.js';
import { DEFAULT_SCAN_THRESHOLDS } from '../utils/thresholds.js';
import type { ProjectScanOptions } from './scan-runner.js';

export async function runLiteScan(
  directory: string,
  detected: DetectedLanguage,
  options: ProjectScanOptions = {}
): Promise<ScanResult> {
  const targetDirectory = ensureDirectoryPath(directory);
  const startedAt = Date.now();
  const thresholds = options.thresholds ?? DEFAULT_SCAN_THRESHOLDS;
  const config = detected.config;

  const discoveredFiles = await discoverFiles(targetDirectory, config.extensions);
  const skippedInputs = await discoverSkippedInputs(targetDirectory, config.extensions);

  const files: FileAnalysis[] = [];
  for (const filePath of discoveredFiles) {
    try {
      files.push(analyzeLiteFile(filePath, targetDirectory, thresholds.locThreshold, config.commentSyntax));
    } catch {
      // skip unreadable files
    }
  }

  const duplication = await analyzeDuplication(targetDirectory, files, []);

  const sourceContents = new Map<string, string>();
  for (const file of files) {
    try {
      sourceContents.set(file.path, readFileSync(file.path, 'utf-8'));
    } catch {
      // skip unreadable
    }
  }

  const security = analyzeSecurityPatterns(files, sourceContents);

  const summary = createEmptySummary(targetDirectory);
  summary.totalFiles = files.length;
  summary.skippedFiles = 0;
  summary.totalLoc = files.reduce((total, file) => total + file.loc, 0);
  summary.totalLines = files.reduce((total, file) => total + file.totalLines, 0);
  summary.flaggedFiles = files.filter((file) => file.isOversized).length;
  summary.flaggedFunctions = 0;
  summary.dependencyHotspots = 0;
  summary.circularDependencies = 0;
  summary.duplicateFindings = duplication.findings.length;
  summary.duplicatedLines = duplication.duplicatedLines;
  summary.scanDurationMs = Date.now() - startedAt;

  const result: ScanResult = {
    summary,
    files,
    parseErrors: [],
    dependencyGraph: createEmptyDependencyGraphSummary(),
    duplication,
    security,
    deadCode: [],
    scanTier: 'lite',
    skippedInputs
  };

  const diagnostics: ScanDiagnostic[] = [{
    phase: 'discovery',
    message: `Lite scan: ${config.name} project (${files.length} files). Complexity, imports, and dependency analysis unavailable.`,
    details: { language: config.id, tier: 'lite' }
  }];

  await attachLiteSkillContext(result, targetDirectory, detected, discoveredFiles);

  const fileSizeScore = scoreFileSizeDistribution(files);
  const duplicationScore = scoreDuplication(duplication);
  const scores = calculateLiteHealthScore(fileSizeScore, duplicationScore);
  if (security.criticalCount > 0) {
    scores.overall = clampScore(scores.overall - security.criticalCount * 5);
    scores.label = scores.overall >= 80 ? 'healthy' : scores.overall >= 50 ? 'warning' : 'critical';
  }
  result.scores = scores;
  result.issues = buildIssues(result);
  result.guidance = createReportGuidance(result);
  result.diagnostics = diagnostics;

  return result;
}

async function attachLiteSkillContext(
  result: ScanResult,
  targetDirectory: string,
  detected: DetectedLanguage,
  discoveredFiles: string[]
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
