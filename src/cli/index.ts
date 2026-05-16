#!/usr/bin/env node
import { Command, CommanderError } from 'commander';
import { existsSync } from 'node:fs';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import type { ScanThresholds } from '../types/scan-output.js';
import { renderScanJson } from '../reporters/scan-json.js';
import { renderScanReport } from '../reporters/terminal.js';
import { runContextCommand } from './context-runner.js';
import { runInitCommand, type InitCommandOptions } from './init-runner.js';
import { runProjectScan } from './scan-runner.js';
import { listSkillsWithActiveStatus, renderSkillList } from '../skills/lister.js';
import { isInteractiveTerminal, promptForDirectory } from '../utils/interactive.js';
import { parseThresholdOption, ThresholdParseError } from '../utils/thresholds.js';

export { runProjectScan } from './scan-runner.js';

const CLI_NAME = 'architect';
const CLI_VERSION = '0.1.0';

type ScanCommandOptions = {
  color?: boolean;
  noColor?: boolean;
  json?: boolean;
  verbose?: boolean;
  threshold?: string;
};

type ScanHandler = (directory: string | undefined, options: ScanCommandOptions) => Promise<number>;
type ContextCommandOptions = {
  techstack: string[];
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
    .exitOverride()
    .action(async (directory: string | undefined, options: ScanCommandOptions) => {
      await onScan(directory, options);
    });

  program
    .command('context')
    .description('Print the full architecture blueprint for one or more skills')
    .requiredOption('--techstack <stacks...>', 'One or more skill IDs or display names to render')
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

    process.stdout.write(`Initialized ${summary.integration} guidance with skill ${summary.skillId}\n`);
    if (summary.filesWritten.length > 0) {
      process.stdout.write(`Files written:\n${summary.filesWritten.map((file) => `- ${file}`).join('\n')}\n`);
    }
    if (summary.filesSkipped.length > 0) {
      process.stdout.write(`Files skipped:\n${summary.filesSkipped.map((file) => `- ${file}`).join('\n')}\n`);
    }
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
