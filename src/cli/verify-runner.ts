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
  const langId = detected?.config.id ?? 'javascript';
  const isJsTs = langId === 'javascript';

  const { errors: compilationErrors, label: compilationLabel } = runCompilationCheck(directory, langId);
  const scanResult = await runProjectScan(directory);
  const brokenImports = isJsTs ? findBrokenImports(directory, scanResult.files) : [];
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
    language: langId,
    compilation_errors: compilationErrors,
    compilation_label: compilationLabel,
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
    passed: compilationErrors === 0 && brokenImports.length === 0,
  };

  if (options.phase && currentSnapshot.total_files > 0) {
    const snapshotPath = join(scansDir, `phase-${options.phase}.json`);
    mkdirSync(dirname(snapshotPath), { recursive: true });
    writeFileSync(snapshotPath, JSON.stringify(currentSnapshot, null, 2) + '\n');
  }

  if (baselineSnapshot && baselineSnapshot.total_files === 0) {
    process.stderr.write('WARN  Baseline snapshot has 0 files — health deltas will be inaccurate. Regenerate with: architect scan . --snapshot .architect/scans/baseline.json\n');
  }

  if (options.json) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } else {
    process.stdout.write(renderVerifyReport(result, { color: options.color }));
  }

  return result.passed ? 0 : 1;
}

function runCompilationCheck(directory: string, language: string): { errors: number; label: string } {
  switch (language) {
    case 'javascript':
      return { errors: runTscCheck(directory), label: 'TypeScript compilation' };
    case 'python':
      return runPythonCheck(directory);
    case 'csharp':
      return runDotnetCheck(directory);
    case 'java':
      return runJavaCheck(directory);
    default:
      return { errors: 0, label: 'Compilation (skipped — unknown language)' };
  }
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

function runPythonCheck(directory: string): { errors: number; label: string } {
  const python = commandExists('python3', directory) ? 'python3' : 'python';
  if (commandExists('mypy', directory)) {
    try {
      execSync(`${python} -m mypy . --ignore-missing-imports --no-error-summary 2>&1`, { cwd: directory, encoding: 'utf-8', stdio: 'pipe' });
      return { errors: 0, label: 'mypy type check' };
    } catch (error) {
      if (error && typeof error === 'object' && 'stdout' in error) {
        const output = (error as { stdout: string }).stdout;
        const errorLines = output.split('\n').filter((line) => /: error:/.test(line));
        return { errors: errorLines.length || 1, label: 'mypy type check' };
      }
      return { errors: 1, label: 'mypy type check' };
    }
  }

  try {
    execSync(`${python} -m py_compile --help 2>&1`, { cwd: directory, encoding: 'utf-8', stdio: 'pipe' });
    execSync(
      `find . -name "*.py" -not -path "*/venv/*" -not -path "*/.venv/*" -not -path "*/node_modules/*" -not -path "*/__pycache__/*" -not -path "*/migrations/*" | head -500 | xargs -I{} ${python} -m py_compile {} 2>&1`,
      { cwd: directory, encoding: 'utf-8', stdio: 'pipe' }
    );
    return { errors: 0, label: 'Python syntax check' };
  } catch (error) {
    if (error && typeof error === 'object' && 'stdout' in error) {
      const output = (error as { stdout: string }).stdout + ((error as { stderr?: string }).stderr ?? '');
      const errorLines = output.split('\n').filter((line) => /SyntaxError|IndentationError|TabError/.test(line));
      return { errors: errorLines.length || 1, label: 'Python syntax check' };
    }
    return { errors: 1, label: 'Python syntax check' };
  }
}

function runDotnetCheck(directory: string): { errors: number; label: string } {
  if (!commandExists('dotnet', directory)) {
    return { errors: 0, label: 'dotnet build (skipped — dotnet not found)' };
  }
  try {
    execSync('dotnet build --no-restore --nologo -v q 2>&1', { cwd: directory, encoding: 'utf-8', stdio: 'pipe' });
    return { errors: 0, label: 'dotnet build' };
  } catch (error) {
    if (error && typeof error === 'object' && 'stdout' in error) {
      const output = (error as { stdout: string }).stdout;
      const errorLines = output.split('\n').filter((line) => /: error CS\d+/.test(line));
      return { errors: errorLines.length || 1, label: 'dotnet build' };
    }
    return { errors: 1, label: 'dotnet build' };
  }
}

function runJavaCheck(directory: string): { errors: number; label: string } {
  if (existsSync(join(directory, 'pom.xml'))) {
    if (!commandExists('mvn', directory)) {
      return { errors: 0, label: 'Maven compile (skipped — mvn not found)' };
    }
    try {
      execSync('mvn compile -q 2>&1', { cwd: directory, encoding: 'utf-8', stdio: 'pipe', timeout: 120000 });
      return { errors: 0, label: 'Maven compile' };
    } catch (error) {
      if (error && typeof error === 'object' && 'stdout' in error) {
        const output = (error as { stdout: string }).stdout;
        const errorLines = output.split('\n').filter((line) => /error:/.test(line) && !/BUILD/.test(line));
        return { errors: errorLines.length || 1, label: 'Maven compile' };
      }
      return { errors: 1, label: 'Maven compile' };
    }
  }

  if (existsSync(join(directory, 'build.gradle')) || existsSync(join(directory, 'build.gradle.kts'))) {
    if (!commandExists('gradle', directory)) {
      return { errors: 0, label: 'Gradle compile (skipped — gradle not found)' };
    }
    try {
      execSync('gradle compileJava -q 2>&1', { cwd: directory, encoding: 'utf-8', stdio: 'pipe', timeout: 120000 });
      return { errors: 0, label: 'Gradle compile' };
    } catch (error) {
      if (error && typeof error === 'object' && 'stdout' in error) {
        const output = (error as { stdout: string }).stdout;
        const errorLines = output.split('\n').filter((line) => /error:/.test(line));
        return { errors: errorLines.length || 1, label: 'Gradle compile' };
      }
      return { errors: 1, label: 'Gradle compile' };
    }
  }

  return { errors: 0, label: 'Java compile (skipped — no build tool found)' };
}

function commandExists(cmd: string, cwd: string): boolean {
  try {
    execSync(`which ${cmd} 2>/dev/null || where ${cmd} 2>nul`, { cwd, encoding: 'utf-8', stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}
