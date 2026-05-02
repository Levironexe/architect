import { Command, CommanderError } from 'commander';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { analyzeFile } from '../analyzers/ast-parser.js';
import { analyzeDependencyGraph } from '../analyzers/dependency-graph.js';
import { analyzeDuplication } from '../analyzers/duplication.js';
import { discoverFiles } from '../analyzers/file-walker.js';
import { classifyConcerns } from '../llm/concern-classifier.js';
import type { LLMProvider } from '../llm/provider.js';
import { createEmptySummary, type FileAnalysis, type ParseError, type ScanResult } from '../types/analysis.js';
import { renderScanReport } from '../reporters/terminal.js';
import { scoreDuplication } from '../scoring/duplication-score.js';
import { calculateHealthScore, calculatePartialHealthScore, toScoreDimension, unavailableDimension } from '../scoring/health-score.js';
import { scoreModularity } from '../scoring/modularity-score.js';
import { scoreSeparation } from '../scoring/separation-score.js';
import { analyzePatterns } from '../scoring/pattern-analysis.js';
import { scoreConsistency } from '../scoring/consistency-score.js';
import { buildIssues, createReportGuidance } from '../scoring/issue-builder.js';
import { collectProjectCharacteristics, detectSkills } from '../skills/detector.js';
import { loadSkills } from '../skills/loader.js';
import { compareStructure } from '../skills/structure-check.js';
import { ensureDirectoryPath } from '../utils/path.js';

const CLI_NAME = 'architect';
const CLI_VERSION = '0.1.0';

type ScanCommandOptions = {
  color?: boolean;
  noColor?: boolean;
  llmProvider?: LLMProvider | null;
};

type ScanHandler = (directory: string, options: ScanCommandOptions) => Promise<number>;

export function createProgram(onScan: ScanHandler): Command {
  const program = new Command();

  program
    .name(CLI_NAME)
    .description('Scan JavaScript and TypeScript projects for structural health signals.')
    .version(CLI_VERSION);

  program
    .command('scan')
    .description('Discover project files and report metrics')
    .argument('<directory>', 'Directory to scan')
    .option('--no-color', 'Disable ANSI color output')
    .exitOverride()
    .action(async (directory: string, options: ScanCommandOptions) => {
      await onScan(directory, options);
    });

  program.command('plan').description('Generate a refactoring plan (placeholder)').exitOverride();
  program.command('skill').description('Manage Architect skills (placeholder)').exitOverride();

  return program;
}

export async function runCli(argv: string[]): Promise<number> {
  let commandExitCode = 0;
  const program = createProgram(async (directory, options) => {
    commandExitCode = await executeScan(directory, options);
    return commandExitCode;
  });

  program.exitOverride();

  try {
    await program.parseAsync(argv, { from: 'user' });
    return commandExitCode;
  } catch (error) {
    if (error instanceof CommanderError) {
      if (error.code === 'commander.helpDisplayed' || error.code === 'commander.version') {
        return 0;
      }

      return error.exitCode;
    }

    throw error;
  }
}

export async function executeScan(directory: string, options: ScanCommandOptions = {}): Promise<number> {
  if (!existsSync(directory)) {
    process.stderr.write(`Target directory does not exist: ${directory}\n`);
    return 3;
  }

  try {
    const targetDirectory = ensureDirectoryPath(directory);
    const startedAt = Date.now();
    const discoveredFiles = await discoverFiles(targetDirectory);
    const analyses: FileAnalysis[] = [];
    const parseErrors: ParseError[] = [];

    for (const filePath of discoveredFiles) {
      try {
        analyses.push(await analyzeFile(filePath, targetDirectory));
      } catch (error) {
        parseErrors.push({
          path: filePath,
          relativePath: filePath.replace(`${targetDirectory}/`, ''),
          error: error instanceof Error ? error.message : 'Unknown parse error'
        });
      }
    }

    const dependencyGraph = await analyzeDependencyGraph(targetDirectory, analyses, parseErrors);
    const duplication = await analyzeDuplication(targetDirectory, analyses, parseErrors);
    const skillLoadResult = await loadSkills();
    const characteristics = await collectProjectCharacteristics(targetDirectory, discoveredFiles, analyses);
    const matchedSkills = detectSkills(characteristics, skillLoadResult.skills);
    const structureComparison = await compareStructure(targetDirectory, matchedSkills);
    const result = buildScanResult(targetDirectory, analyses, parseErrors, dependencyGraph, duplication, Date.now() - startedAt);
    result.skillLoadWarnings = skillLoadResult.warnings;
    result.matchedSkills = matchedSkills;
    result.structureComparison = structureComparison;
    const modularityScore = scoreModularity(analyses);
    const duplicationScore = scoreDuplication(duplication);
    result.scores = calculatePartialHealthScore(modularityScore, duplicationScore);
    const classification = await classifyConcerns({
      projectRoot: targetDirectory,
      files: analyses,
      matchedSkills,
      provider: options.llmProvider
    });
    result.classifications = classification.classifications;
    result.classificationStatus = classification.status;
    const separationScore = scoreSeparation(classification.classifications);
    const patternFindings = analyzePatterns(classification.classifications);
    const consistencyScore = scoreConsistency(patternFindings);
    result.patternFindings = patternFindings;
    const health = calculateHealthScore({
      separation: separationScore
        ? toScoreDimension('separation', separationScore)
        : unavailableDimension('separation', 30, 'Concern classification was unavailable'),
      consistency: consistencyScore
        ? toScoreDimension('consistency', consistencyScore)
        : unavailableDimension('consistency', 25, 'Pattern consistency analysis was unavailable'),
      modularity: toScoreDimension('modularity', modularityScore),
      duplication: toScoreDimension('duplication', duplicationScore)
    });
    result.health = health.health;
    result.dimensions = health.dimensions;
    result.issues = buildIssues(result);
    result.guidance = createReportGuidance(result);

    renderScanReport(result, { color: options.color !== false && options.noColor !== true });
    return 0;
  } catch (error) {
    if (error instanceof Error) {
      process.stderr.write(`${error.message}\n`);
      return 3;
    }

    throw error;
  }
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
  summary.flaggedFunctions = files.reduce(
    (total, file) => total + file.functions.filter((item: { isFlagged: boolean }) => item.isFlagged).length,
    0
  );
  summary.dependencyHotspots = dependencyGraph.hotspots.length;
  summary.circularDependencies = dependencyGraph.circularDependencies.length;
  summary.duplicateFindings = duplication.findings.length;
  summary.duplicatedLines = duplication.duplicatedLines;
  summary.scanDurationMs = scanDurationMs;

  return {
    summary,
    files,
    parseErrors,
    dependencyGraph,
    duplication
  };
}

async function main(): Promise<void> {
  const exitCode = await runCli(process.argv.slice(2));
  process.exitCode = exitCode;
}

const executedFilePath = fileURLToPath(import.meta.url);

if (process.argv[1] === executedFilePath) {
  void main();
}
