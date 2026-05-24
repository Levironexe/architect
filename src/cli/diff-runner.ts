import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Chalk } from 'chalk';
import type { ScanSnapshot, DiffMetric } from '../types/state.js';
import { renderDiffReport } from '../reporters/diff-terminal.js';

export interface DiffCommandOptions {
  phase?: string;
  json?: boolean;
  color?: boolean;
}

export async function executeDiff(directory: string, options: DiffCommandOptions = {}): Promise<number> {
  const chalk = new Chalk({ level: options.color !== false ? 1 : 0 });
  const scansDir = join(directory, '.architect', 'scans');

  if (!existsSync(scansDir)) {
    process.stderr.write(`No scan snapshots found at ${scansDir}\nRun: architect scan . --snapshot .architect/scans/baseline.json\n`);
    return 3;
  }

  const baselinePath = join(scansDir, 'baseline.json');
  if (!existsSync(baselinePath)) {
    process.stderr.write(`No baseline snapshot found at ${baselinePath}\nRun: architect scan . --snapshot .architect/scans/baseline.json\n`);
    return 3;
  }

  const baseline = loadSnapshot(baselinePath);
  const afterSnapshot = resolveAfterSnapshot(scansDir, options.phase);

  if (!afterSnapshot) {
    process.stderr.write('No comparison snapshot found. Run architect scan with --snapshot after a refactoring phase.\n');
    return 3;
  }

  const after = loadSnapshot(afterSnapshot);
  const metrics = computeMetrics(baseline, after);

  if (options.json) {
    process.stdout.write(JSON.stringify({ baseline, after, metrics }, null, 2) + '\n');
  } else {
    process.stdout.write(renderDiffReport(metrics, { color: options.color }));
  }

  return 0;
}

function loadSnapshot(filePath: string): ScanSnapshot {
  return JSON.parse(readFileSync(filePath, 'utf-8')) as ScanSnapshot;
}

function resolveAfterSnapshot(scansDir: string, phase?: string): string | null {
  if (phase) {
    const phasePath = join(scansDir, `phase-${phase}.json`);
    return existsSync(phasePath) ? phasePath : null;
  }

  const files = readdirSync(scansDir)
    .filter((f) => f.includes('phase-') && f.endsWith('.json'))
    .sort((a, b) => {
      const numA = parseInt(a.match(/phase-(\d+)/)?.[1] ?? '0', 10);
      const numB = parseInt(b.match(/phase-(\d+)/)?.[1] ?? '0', 10);
      return numA - numB;
    });

  if (files.length === 0) return null;
  return join(scansDir, files[files.length - 1]!);
}

function computeMetrics(before: ScanSnapshot, after: ScanSnapshot): DiffMetric[] {
  return [
    { label: 'Health score', before: before.health_score, after: after.health_score, delta: after.health_score - before.health_score, higherIsBetter: true },
    { label: 'Flagged files', before: before.flagged_files, after: after.flagged_files, delta: after.flagged_files - before.flagged_files },
    { label: 'Duplication', before: before.duplication_pct, after: after.duplication_pct, delta: round(after.duplication_pct - before.duplication_pct), unit: '%' },
    { label: 'Circular deps', before: before.circular_deps, after: after.circular_deps, delta: after.circular_deps - before.circular_deps },
    { label: 'Avg file LOC', before: before.avg_file_loc, after: after.avg_file_loc, delta: after.avg_file_loc - before.avg_file_loc },
    { label: 'God files (>300)', before: before.god_files, after: after.god_files, delta: after.god_files - before.god_files },
    { label: 'Total files', before: before.total_files, after: after.total_files, delta: after.total_files - before.total_files },
    { label: 'Total LOC', before: before.total_loc, after: after.total_loc, delta: after.total_loc - before.total_loc },
  ];
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
