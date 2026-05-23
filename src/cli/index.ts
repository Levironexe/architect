#!/usr/bin/env node
import { Command, CommanderError } from 'commander';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { realpathSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { Chalk } from 'chalk';

import type { ScanThresholds } from '../types/scan-output.js';
import { renderScanJson } from '../reporters/scan-json.js';
import { renderScanReport } from '../reporters/terminal.js';
import { runContextCommand } from './context-runner.js';
import { runInitCommand, type InitCommandOptions } from './init-runner.js';
import { runProjectScan } from './scan-runner.js';
import { executeDiff } from './diff-runner.js';
import { executeStatus } from './status-runner.js';
import { executeVerify } from './verify-runner.js';
import { extractSnapshot } from '../reporters/snapshot.js';
import { listSkillsWithActiveStatus, renderSkillList } from '../skills/lister.js';
import { isInteractiveTerminal, promptForDirectory } from '../utils/interactive.js';
import { parseThresholdOption, ThresholdParseError } from '../utils/thresholds.js';

export { runProjectScan } from './scan-runner.js';

const CLI_NAME = 'architect';
const CLI_VERSION = (createRequire(import.meta.url)('../../package.json') as { version: string }).version;

type ScanCommandOptions = {
  color?: boolean;
  noColor?: boolean;
  json?: boolean;
  verbose?: boolean;
  threshold?: string;
  snapshot?: string;
};

type ScanHandler = (directory: string | undefined, options: ScanCommandOptions) => Promise<number>;
type ContextCommandOptions = {
  techstack?: string[];
};
type ContextHandler = (options: ContextCommandOptions) => Promise<number>;
type InitHandler = (directory: string, options: InitCommandOptions) => Promise<number>;
type SkillListHandler = () => Promise<number>;

export function createProgram(
  onScan: ScanHandler,
  onContext: ContextHandler,
  onInit: InitHandler,
  onSkillList: SkillListHandler = executeSkillList
): Command {
  const program = new Command();

  program
    .name(CLI_NAME)
    .description('Scan JavaScript and TypeScript projects for structural health signals.')
    .version(CLI_VERSION);

  program
    .command('scan')
    .description('Discover project files and report metrics')
    .argument('[directory]', 'Directory to scan; prompts interactively when omitted')
    .option('--no-color', 'Disable ANSI color output')
    .option('--json', 'Emit machine-readable JSON output')
    .option('--verbose', 'Emit detailed scan diagnostics')
    .option('--threshold <values>', 'Customize thresholds, for example: loc=300,complexity=15')
    .option('--snapshot <path>', 'Save scan result as JSON snapshot to the given file path')
    .exitOverride()
    .action(async (directory: string | undefined, options: ScanCommandOptions) => {
      await onScan(directory, options);
    });

  program
    .command('context')
    .description('Print the full architecture blueprint for one or more skills')
    .option('--techstack [stacks...]', 'One or more skill IDs; auto-detects from current directory when omitted')
    .exitOverride()
    .action(async (options: ContextCommandOptions) => {
      await onContext(options);
    });

  program
    .command('init')
    .description('Generate coding-agent guidance files for a project')
    .argument('<directory>', 'Directory to initialize')
    .option('--skill <id>', 'Override automatic skill detection')
    .option('--integration <agent>', 'Override automatic agent detection')
    .option('--update', 'Overwrite existing Architect guidance files')
    .exitOverride()
    .action(async (directory: string, options: InitCommandOptions) => {
      await onInit(directory, options);
    });

  const skillCmd = program.command('skill').description('Manage Architect skills').exitOverride();

  skillCmd
    .command('list')
    .description('List all available skills, marking which are active in the current directory')
    .exitOverride()
    .action(async () => {
      await onSkillList();
    });

  return program;
}

export async function runCli(argv: string[]): Promise<number> {
  let commandExitCode = 0;
  const program = createProgram(
    async (directory, options) => {
      commandExitCode = await executeScan(directory, options);
      return commandExitCode;
    },
    async (options) => {
      commandExitCode = await executeContext(options);
      return commandExitCode;
    },
    async (directory, options) => {
      commandExitCode = await executeInit(directory, options);
      return commandExitCode;
    },
    async () => {
      commandExitCode = await executeSkillList();
      return commandExitCode;
    }
  );

  program
    .command('diff')
    .description('Compare scan snapshots to show before/after metrics')
    .argument('<directory>', 'Project directory containing .architect/scans/')
    .option('--phase <number>', 'Compare baseline against a specific phase snapshot')
    .option('--json', 'Emit machine-readable JSON output')
    .option('--no-color', 'Disable ANSI color output')
    .exitOverride()
    .action(async (directory: string, opts: { phase?: string; json?: boolean; color?: boolean }) => {
      commandExitCode = await executeDiff(directory, opts);
    });

  program
    .command('status')
    .description('Show refactoring phase progress')
    .argument('<directory>', 'Project directory containing .architect/state.json')
    .option('--json', 'Emit machine-readable JSON output')
    .option('--no-color', 'Disable ANSI color output')
    .exitOverride()
    .action(async (directory: string, opts: { json?: boolean; color?: boolean }) => {
      commandExitCode = await executeStatus(directory, opts);
    });

  program
    .command('verify')
    .description('Run post-phase verification (TypeScript check, import resolution, scan delta)')
    .argument('<directory>', 'Project directory to verify')
    .option('--phase <number>', 'Phase number (saves snapshot as phase-N)')
    .option('--json', 'Emit machine-readable JSON output')
    .option('--no-color', 'Disable ANSI color output')
    .exitOverride()
    .action(async (directory: string, opts: { phase?: string; json?: boolean; color?: boolean }) => {
      commandExitCode = await executeVerify(directory, opts);
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

export async function executeScan(directory: string | undefined, options: ScanCommandOptions = {}): Promise<number> {
  const targetDirectory = await resolveScanTarget(directory, options);
  if (!targetDirectory) {
    return 3;
  }

  if (!existsSync(targetDirectory)) {
    process.stderr.write(`Target directory does not exist: ${targetDirectory}\nCheck the path and run architect scan <directory>.\n`);
    return 3;
  }

  const thresholds = parseScanThresholds(options);
  if (!thresholds) {
    return 3;
  }

  try {
    const result = await runProjectScan(targetDirectory, { ...options, thresholds });
    if (options.snapshot) {
      const snapshot = extractSnapshot(result);
      const snapshotDir = dirname(options.snapshot);
      mkdirSync(snapshotDir, { recursive: true });
      writeFileSync(options.snapshot, JSON.stringify(snapshot, null, 2) + '\n');
      if (snapshot.total_files === 0) {
        process.stderr.write(`WARN  Snapshot saved with 0 files — this baseline will be useless. Check that you are in the correct directory and the language is supported.\n`);
      } else {
        process.stderr.write(`Snapshot saved: ${options.snapshot}\n`);
      }
    }

    if (options.json) {
      process.stdout.write(renderScanJson({
        result,
        targetDir: result.summary.targetDir,
        verbose: options.verbose === true,
        durationMs: result.summary.scanDurationMs,
        warnings: result.warnings ?? [],
        diagnostics: result.diagnostics ?? []
      }));
    } else {
      renderScanReport(result, { color: options.color !== false && options.noColor !== true, verbose: options.verbose === true });
    }
    return 0;
  } catch (error) {
    if (error instanceof Error) {
      process.stderr.write(`${error.message}\n`);
      return 3;
    }

    throw error;
  }
}

export async function executeContext(options: ContextCommandOptions): Promise<number> {
  try {
    const output = await runContextCommand(options.techstack ?? []);
    process.stdout.write(`${output}\n`);
    return 0;
  } catch (error) {
    if (error instanceof Error) {
      process.stderr.write(`${error.message}\n`);
      return 3;
    }

    throw error;
  }
}

export async function executeInit(directory: string, options: InitCommandOptions = {}): Promise<number> {
  if (!existsSync(directory)) {
    process.stderr.write(`Target directory does not exist: ${directory}\nCheck the path and run architect init <directory>.\n`);
    return 3;
  }

  try {
    const summary = await runInitCommand(directory, options);

    const chalk = new Chalk({ level: 1 });
    const INTEGRATION_DISPLAY: Record<string, string> = {
      claude: 'Claude Code',
      cursor: 'Cursor',
      windsurf: 'Windsurf',
      copilot: 'GitHub Copilot',
      generic: 'Other',
    };
    const agentDisplay = INTEGRATION_DISPLAY[summary.integration] ?? summary.integration;

    process.stdout.write(`${chalk.green('✓')} Detected stack:  ${summary.skillName}\n`);
    process.stdout.write(`${chalk.green('✓')} Detected agent:  ${agentDisplay}\n`);

    if (summary.filesWritten.length > 0) {
      process.stdout.write(`${chalk.green('✓')} Installed ${summary.filesWritten.length} skill${summary.filesWritten.length !== 1 ? 's' : ''}:\n`);
      for (const file of summary.filesWritten) {
        const dir = file.replace(/\/[^/]+$/, '/');
        const skillName = `/${dir.replace(/.*skills\//, '').replace(/\/$/, '')}`;
        process.stdout.write(`  ${chalk.gray(skillName.padEnd(20))} → ${dir}\n`);
      }
    }

    if (summary.filesSkipped.length > 0) {
      process.stdout.write(`\n${chalk.yellow('!')} Files skipped (already exist):\n`);
      for (const file of summary.filesSkipped) {
        process.stdout.write(`  - ${file}\n`);
      }
    }

    process.stdout.write(`\nOpen ${agentDisplay} and run /architect-plan to get started.\n`);

    for (const warning of summary.warnings) {
      process.stderr.write(`${warning}\n`);
    }

    return 0;
  } catch (error) {
    if (error instanceof Error) {
      process.stderr.write(`${error.message}\n`);
      return 3;
    }

    throw error;
  }
}

export async function executeSkillList(): Promise<number> {
  try {
    const checks = await listSkillsWithActiveStatus(process.cwd());
    process.stdout.write(renderSkillList(checks));
    return 0;
  } catch (error) {
    if (error instanceof Error) {
      process.stderr.write(`${error.message}\n`);
      return 3;
    }

    throw error;
  }
}

async function resolveScanTarget(directory: string | undefined, options: ScanCommandOptions): Promise<string | null> {
  if (directory) {
    return directory;
  }

  if (options.json || !isInteractiveTerminal()) {
    process.stderr.write('Target directory required. Pass a directory, for example: architect scan .\n');
    return null;
  }

  return promptForDirectory();
}

function parseScanThresholds(options: ScanCommandOptions): ScanThresholds | null {
  try {
    return parseThresholdOption(options.threshold);
  } catch (error) {
    if (error instanceof ThresholdParseError) {
      process.stderr.write(`${error.message}\n`);
      return null;
    }

    throw error;
  }
}

async function main(): Promise<void> {
  const exitCode = await runCli(process.argv.slice(2));
  process.exitCode = exitCode;
}

const executedFilePath = fileURLToPath(import.meta.url);

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(executedFilePath)) {
  void main();
}
