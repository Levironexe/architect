import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { Chalk } from 'chalk';
import type { ArchitectState } from '../types/state.js';

export interface StatusCommandOptions {
  json?: boolean;
  color?: boolean;
}

export async function executeStatus(directory: string, options: StatusCommandOptions = {}): Promise<number> {
  const chalk = new Chalk({ level: options.color !== false ? 1 : 0 });
  const statePath = join(directory, '.architect', 'state.json');
  const planPath = join(directory, '.architect', 'plan.md');

  if (!existsSync(statePath)) {
    process.stderr.write(`No state file found at ${statePath}\nRun /architect-plan first to generate a plan with state tracking.\n`);
    return 3;
  }

  const state = JSON.parse(readFileSync(statePath, 'utf-8')) as ArchitectState;

  if (options.json) {
    process.stdout.write(JSON.stringify(state, null, 2) + '\n');
    return 0;
  }

  const lines: string[] = [];
  lines.push(chalk.bold('Architect Refactoring Progress'));
  lines.push('');

  if (existsSync(planPath)) {
    lines.push(`Plan: .architect/plan.md (${state.total_phases} phases)`);
  }

  if (state.baseline_health !== null) {
    const healthStr = state.latest_health !== null
      ? `Health: ${state.baseline_health} → ${state.latest_health} (${formatDelta(state.latest_health - state.baseline_health)})`
      : `Health: ${state.baseline_health} (baseline)`;
    lines.push(healthStr);
  }

  lines.push('');

  for (const phase of state.phases) {
    const icon = statusIcon(phase.status, chalk);
    const suffix = phase.status === 'in_progress' ? chalk.yellow(' (in progress)') : '';
    lines.push(`  ${icon} Phase ${phase.id}: ${phase.name}${suffix}`);
  }

  const completed = state.phases.filter((p) => p.status === 'completed').length;
  const pct = state.total_phases > 0 ? Math.round((completed / state.total_phases) * 100) : 0;

  lines.push('');
  lines.push(`Progress: ${completed}/${state.total_phases} phases complete (${pct}%)`);

  const next = state.phases.find((p) => p.status === 'pending' || p.status === 'in_progress');
  if (next) {
    lines.push(`Next: Phase ${next.id} — ${next.name}`);
  }

  lines.push('');
  lines.push('Run /architect-refactor to continue.');
  lines.push('');

  process.stdout.write(lines.join('\n'));
  return 0;
}

function statusIcon(status: string, chalk: InstanceType<typeof Chalk>): string {
  switch (status) {
    case 'completed': return chalk.green('✓');
    case 'in_progress': return chalk.yellow('◐');
    case 'failed': return chalk.red('✗');
    default: return chalk.gray('○');
  }
}

function formatDelta(delta: number): string {
  return delta >= 0 ? `+${delta}` : String(delta);
}
