import { Command, CommanderError } from 'commander';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { analyzeFile } from '../analyzers/ast-parser.js';
import { analyzeDependencyGraph } from '../analyzers/dependency-graph.js';
import { analyzeDuplication } from '../analyzers/duplication.js';
import { discoverFiles } from '../analyzers/file-walker.js';
import { renderPlanJson } from '../formatters/plan-json.js';
import { renderPlanMarkdown } from '../formatters/plan-markdown.js';
import { renderPlanPrompt } from '../formatters/plan-prompt.js';
import { renderPlanTerminal } from '../formatters/plan-terminal.js';
import { classifyConcerns } from '../llm/concern-classifier.js';
import type { LLMProvider } from '../llm/provider.js';
import { generateRefactorPlan, primarySkillFrom } from '../planner/plan-generator.js';
import { validateRefactorPlan } from '../planner/plan-validator.js';
import { createEmptySummary, type FileAnalysis, type ParseError, type ScanResult } from '../types/analysis.js';
import type { PlanOutputFormat } from '../types/plan.js';
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

type PlanCommandOptions = ScanCommandOptions & {
  format?: string;
};

type ScanHandler = (directory: string, options: ScanCommandOptions) => Promise<number>;
type PlanHandler = (directory: string, options: PlanCommandOptions) => Promise<number>;

export function createProgram(onScan: ScanHandler, onPlan: PlanHandler): Command {
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

  program
    .command('plan')
    .description('Generate a refactoring plan')
    .argument('<directory>', 'Directory to analyze and plan')
    .option('--format <format>', 'Output format: terminal, md, json, or prompt', 'terminal')
    .option('--no-color', 'Disable ANSI color output')
    .exitOverride()
    .action(async (directory: string, options: PlanCommandOptions) => {
      await onPlan(directory, options);
    });
  program.command('skill').description('Manage Architect skills (placeholder)').exitOverride();

  return program;
}

export async function runCli(argv: string[]): Promise<number> {
  let commandExitCode = 0;
  const program = createProgram(
    async (directory, options) => {
      commandExitCode = await executeScan(directory, options);
      return commandExitCode;
    },
    async (directory, options) => {
      commandExitCode = await executePlan(directory, options);
      return commandExitCode;
    }
  );

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
    const result = await runProjectScan(directory, options);
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

export async function executePlan(directory: string, options: PlanCommandOptions = {}): Promise<number> {
  if (!existsSync(directory)) {
    process.stderr.write(`Target directory does not exist: ${directory}\n`);
    return 3;
  }

  const format = normalizePlanFormat(options.format ?? 'terminal');
  if (!format) {
    process.stderr.write('Unsupported plan format. Supported formats: terminal, md, json, prompt\n');
    return 3;
  }

  try {
    const scan = await runProjectScan(directory, options);
    const primarySkill = primarySkillFrom(scan);
    const plan = validateRefactorPlan(generateRefactorPlan({ scan, primarySkill }));
    const color = options.color !== false && options.noColor !== true;
    const output = renderPlan(format, plan, scan, primarySkill, color);
    process.stdout.write(output);
    return 0;
  } catch (error) {
    if (error instanceof Error) {
      process.stderr.write(`${error.message}\n`);
      return 3;
    }

    throw error;
  }
}

export async function runProjectScan(directory: string, options: ScanCommandOptions = {}): Promise<ScanResult> {
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

  return result;
}

function normalizePlanFormat(format: string): PlanOutputFormat | null {
  if (format === 'terminal' || format === 'md' || format === 'json' || format === 'prompt') {
    return format;
  }

  return null;
}

function renderPlan(format: PlanOutputFormat, plan: ReturnType<typeof validateRefactorPlan>, scan: ScanResult, primarySkill: ReturnType<typeof primarySkillFrom>, color: boolean): string {
  if (format === 'md') return renderPlanMarkdown(plan);
  if (format === 'json') return renderPlanJson(plan);
  if (format === 'prompt') return renderPlanPrompt(plan, scan, primarySkill);
  return renderPlanTerminal(plan, { color });
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
