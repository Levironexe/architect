import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { execSync } from 'node:child_process';
import type { ArchitectState, ScanSnapshot, VerifyResult } from '../types/state.js';
import { runProjectScan } from './scan-runner.js';
import { extractSnapshot } from '../reporters/snapshot.js';
import { findBrokenImports } from '../analyzers/dependency-graph.js';
import { renderVerifyReport } from '../reporters/verify-terminal.js';
import { detectLanguage } from '../languages/registry.js';

export interface VerifyCommandOptions {
  phase?: string;
  json?: boolean;
  color?: boolean;
}

export async function executeVerify(directory: string, options: VerifyCommandOptions = {}): Promise<number> {
  const scansDir = join(directory, '.architect', 'scans');
  const statePath = join(directory, '.architect', 'state.json');

  const detected = await detectLanguage(directory);
  const isFullScan = detected?.config.supportsScanning === 'full';
  const tscErrors = isFullScan ? runTscCheck(directory) : 0;
  const scanResult = await runProjectScan(directory);
  const brokenImports = isFullScan ? findBrokenImports(directory, scanResult.files) : [];
  const currentSnapshot = extractSnapshot(scanResult);

  let baselineSnapshot: ScanSnapshot | null = null;
  const baselinePath = join(scansDir, 'baseline.json');
  if (existsSync(baselinePath)) {
    baselineSnapshot = JSON.parse(readFileSync(baselinePath, 'utf-8')) as ScanSnapshot;
  }

  let phaseName: string | undefined;
  if (options.phase && existsSync(statePath)) {
    const state = JSON.parse(readFileSync(statePath, 'utf-8')) as ArchitectState;
    const phaseNum = parseInt(options.phase, 10);
    const phase = state.phases.find((p) => p.id === phaseNum);
    if (phase) phaseName = phase.name;
  }

  const result: VerifyResult = {
    phase: options.phase ? parseInt(options.phase, 10) : undefined,
    phase_name: phaseName,
    tsc_errors: tscErrors,
    broken_imports: brokenImports,
    new_circular_deps: baselineSnapshot
      ? currentSnapshot.circular_deps - baselineSnapshot.circular_deps
      : currentSnapshot.circular_deps,
    duplication_delta: baselineSnapshot
      ? Math.round((currentSnapshot.duplication_pct - baselineSnapshot.duplication_pct) * 10) / 10
      : 0,
    health_delta: baselineSnapshot
      ? currentSnapshot.health_score - baselineSnapshot.health_score
      : 0,
    passed: tscErrors === 0 && brokenImports.length === 0,
  };

  if (options.phase) {
    const snapshotPath = join(scansDir, `phase-${options.phase}.json`);
    mkdirSync(dirname(snapshotPath), { recursive: true });
    writeFileSync(snapshotPath, JSON.stringify(currentSnapshot, null, 2) + '\n');
  }

  if (options.json) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } else {
    process.stdout.write(renderVerifyReport(result, { color: options.color }));
  }

  return result.passed ? 0 : 1;
}

function runTscCheck(directory: string): number {
  try {
    execSync('npx tsc --noEmit 2>&1', { cwd: directory, encoding: 'utf-8', stdio: 'pipe' });
    return 0;
  } catch (error) {
    if (error && typeof error === 'object' && 'stdout' in error) {
      const output = (error as { stdout: string }).stdout;
      const errorLines = output.split('\n').filter((line) => /error TS\d+/.test(line));
      return errorLines.length || 1;
    }
    return 1;
  }
}
