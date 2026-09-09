import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { analyzeProject } from '../analyzers/project.js';
import { renderCheckReport, renderRuleList } from '../reporters/check-terminal.js';
import { createRuleContext, runRules } from '../rules/engine.js';
import { loadSkills } from '../skills/loader.js';
import type { CheckResult, RuleViolation } from '../types/rule.js';
import { ensureDirectoryPath } from '../utils/path.js';

export const BASELINE_PATH = '.architect/baseline.json';

export interface CheckCommandOptions {
  json?: boolean;
  color?: boolean;
  listRules?: boolean;
  baseline?: boolean;
  /** Comma-separated rule ids to drop from the report. */
  ignore?: string;
}

export interface Baseline {
  created: string;
  stack: string | null;
  violations: number;
  critical: number;
  warning: number;
}

/** 0 clean · 1 critical violations · 2 no stack detected or unreadable config. */
export async function executeCheck(directory: string | undefined, options: CheckCommandOptions = {}): Promise<number> {
  if (options.listRules) {
    return listRules(options);
  }

  const target = directory ?? '.';
  if (!existsSync(target)) {
    process.stderr.write(`Target directory does not exist: ${target}\nCheck the path and run architect check <directory>.\n`);
    return 2;
  }

  const rootDir = ensureDirectoryPath(target);
  const result = await runCheck(rootDir, parseIgnore(options.ignore));

  if (result.stack === null) {
    if (options.json) {
      process.stdout.write(`${JSON.stringify(toJson(result), null, 2)}\n`);
    } else {
      process.stderr.write(
        'No supported stack detected.\n'
        + 'architect 1.0 checks Next.js App Router projects written in TypeScript.\n'
      );
    }
    return 2;
  }

  if (options.baseline) {
    return writeBaseline(rootDir, result);
  }

  if (options.json) {
    process.stdout.write(`${JSON.stringify(toJson(result), null, 2)}\n`);
  } else {
    renderCheckReport(result, { color: options.color });
  }

  return result.summary.critical > 0 ? 1 : 0;
}

export async function runCheck(rootDir: string, ignoredRules: Set<string> = new Set()): Promise<CheckResult> {
  const analysis = await analyzeProject(rootDir);
  const primary = analysis.primarySkill;

  if (!primary) {
    return { stack: null, filesChecked: analysis.files.length, violations: [], summary: emptySummary() };
  }

  const violations = runRules(primary, createRuleContext(analysis.files, rootDir))
    .filter((violation) => !ignoredRules.has(violation.rule));

  for (const entry of analysis.structureComparison?.entries ?? []) {
    if (entry.status !== 'missing' || !entry.required) continue;
    if (ignoredRules.has('missing_layer')) continue;
    violations.push({
      rule: 'missing_layer',
      severity: 'warning',
      file: `${entry.path}/`,
      line: 0,
      message: `Required directory ${entry.path}/ does not exist.`,
      fix: entry.purpose
    });
  }

  return {
    stack: primary.id,
    filesChecked: analysis.files.length,
    violations,
    summary: summarize(violations)
  };
}

async function listRules(options: CheckCommandOptions): Promise<number> {
  const { skills } = await loadSkills();

  if (options.json) {
    const rules = skills.flatMap((skill) =>
      skill.antiPatterns.map((antiPattern) => ({
        stack: skill.id,
        rule: antiPattern.id,
        severity: antiPattern.severity,
        checkable: Boolean(antiPattern.detect),
        description: antiPattern.description
      }))
    );
    process.stdout.write(`${JSON.stringify({ rules }, null, 2)}\n`);
    return 0;
  }

  renderRuleList(skills, { color: options.color });
  return 0;
}

function writeBaseline(rootDir: string, result: CheckResult): number {
  const baseline: Baseline = {
    created: new Date().toISOString(),
    stack: result.stack,
    violations: result.violations.length,
    critical: result.summary.critical,
    warning: result.summary.warning
  };

  const target = join(rootDir, BASELINE_PATH);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(baseline, null, 2)}\n`);
  process.stdout.write(`Baseline written to ${BASELINE_PATH} (${baseline.violations} violations).\n`);
  return 0;
}

export function readBaseline(rootDir: string): Baseline | null {
  const target = join(rootDir, BASELINE_PATH);
  if (!existsSync(target)) return null;

  try {
    return JSON.parse(readFileSync(target, 'utf8')) as Baseline;
  } catch {
    return null;
  }
}

function parseIgnore(value: string | undefined): Set<string> {
  return new Set((value ?? '').split(',').map((rule) => rule.trim()).filter(Boolean));
}

function toJson(result: CheckResult): Record<string, unknown> {
  return {
    stack: result.stack,
    files_checked: result.filesChecked,
    violations: result.violations.map((violation) => ({
      rule: violation.rule,
      severity: violation.severity,
      file: violation.file,
      line: violation.line,
      message: violation.message,
      fix: violation.fix
    })),
    summary: result.summary
  };
}

function summarize(violations: RuleViolation[]): CheckResult['summary'] {
  const summary = emptySummary();
  for (const violation of violations) {
    summary[violation.severity] += 1;
  }
  return summary;
}

function emptySummary(): CheckResult['summary'] {
  return { critical: 0, warning: 0, info: 0 };
}
