#!/usr/bin/env node
import { Command, CommanderError } from 'commander';
import { existsSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { Chalk } from 'chalk';

import { executeCheck, type CheckCommandOptions } from './check-runner.js';
import { runInitCommand, type InitCommandOptions } from './init-runner.js';
import { executeVerify } from './verify-runner.js';

export { runCheck, executeCheck } from './check-runner.js';
export { analyzeProject } from '../analyzers/project.js';

const CLI_NAME = 'architect';
const CLI_VERSION = (createRequire(import.meta.url)('../../package.json') as { version: string }).version;

type CheckHandler = (directory: string | undefined, options: CheckCommandOptions) => Promise<number>;
type InitHandler = (directory: string, options: InitCommandOptions) => Promise<number>;
type VerifyHandler = (directory: string, options: VerifyCliOptions) => Promise<number>;

interface VerifyCliOptions {
  phase?: string;
  strict?: boolean;
  json?: boolean;
  color?: boolean;
}

export function createProgram(
  onCheck: CheckHandler,
  onInit: InitHandler,
  onVerify: VerifyHandler
): Command {
  const program = new Command();

  program
    .name(CLI_NAME)
    .description('Architecture linter for Next.js App Router projects written in TypeScript.')
    .version(CLI_VERSION);

  program
    .command('check')
    .description('Check a project against its stack blueprint')
    .argument('[directory]', 'Directory to check; defaults to the current directory')
    .option('--json', 'Emit machine-readable JSON output')
    .option('--list-rules', 'List every rule with its severity, then exit')
    .option('--baseline', 'Write .architect/baseline.json instead of reporting')
    .option('--no-color', 'Disable ANSI color output')
    .exitOverride()
    .action(async (directory: string | undefined, options: CheckCommandOptions) => {
      exitCode = await onCheck(directory, options);
    });

  program
    .command('init')
    .description('Install the Claude Code skills for this project')
    .argument('<directory>', 'Directory to initialize')
    .option('--skill <id>', 'Override automatic stack detection')
    .option('--update', 'Overwrite existing Architect guidance files')
    .exitOverride()
    .action(async (directory: string, options: InitCommandOptions) => {
      exitCode = await onInit(directory, options);
    });

  program
    .command('verify')
    .description('Fail if the violation count rose against the recorded baseline')
    .argument('[directory]', 'Directory to verify; defaults to the current directory')
    .option('--phase <number>', 'Phase number (saves a snapshot as phase-N)')
    .option('--strict', 'Fail when violations increase against the baseline')
    .option('--json', 'Emit machine-readable JSON output')
    .option('--no-color', 'Disable ANSI color output')
    .exitOverride()
    .action(async (directory: string | undefined, options: VerifyCliOptions) => {
      exitCode = await onVerify(directory ?? '.', options);
    });

  return program;
}

let exitCode = 0;

export async function runCli(argv: string[]): Promise<number> {
  exitCode = 0;

  const program = createProgram(
    (directory, options) => executeCheck(directory, options),
    (directory, options) => executeInit(directory, options),
    (directory, options) => executeVerify(directory, options)
  );

  program.exitOverride();

  try {
    await program.parseAsync(argv, { from: 'user' });
    return exitCode;
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

export async function executeInit(directory: string, options: InitCommandOptions = {}): Promise<number> {
  if (!existsSync(directory)) {
    process.stderr.write(`Target directory does not exist: ${directory}\nCheck the path and run architect init <directory>.\n`);
    return 2;
  }

  try {
    const summary = await runInitCommand(directory, options);
    const chalk = new Chalk({ level: 1 });

    process.stdout.write(`${chalk.green('✓')} Detected stack:  ${summary.skillName}\n`);
    process.stdout.write(`${chalk.green('✓')} Detected agent:  Claude Code\n`);

    if (summary.filesWritten.length > 0) {
      const count = summary.filesWritten.length;
      process.stdout.write(`${chalk.green('✓')} Installed ${count} skill${count === 1 ? '' : 's'}:\n`);
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

    process.stdout.write('\nOpen Claude Code and run /architect-plan to get started.\n');

    for (const warning of summary.warnings) {
      process.stderr.write(`${warning}\n`);
    }

    return 0;
  } catch (error) {
    if (error instanceof Error) {
      process.stderr.write(`${error.message}\n`);
      return 2;
    }

    throw error;
  }
}

async function main(): Promise<void> {
  process.exitCode = await runCli(process.argv.slice(2));
}

const executedFilePath = fileURLToPath(import.meta.url);

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(executedFilePath)) {
  void main();
}
