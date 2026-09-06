import { readFileSync } from 'node:fs';

import type { FileAnalysis } from '../types/analysis.js';
import type { DetectSpec, RuleViolation } from '../types/rule.js';
import type { AntiPattern, ArchitectureSkill } from '../types/skill.js';
import { createAstFactsCache, extractAstFacts, type AstFactsCache } from './ast-facts.js';
import { matchesAnyGlob, matchesGlob } from './glob.js';

export interface RuleContext {
  files: FileAnalysis[];
  /** Repo-relative path -> source text. Read once, shared by every matcher. */
  sources: Map<string, string>;
  /** Absolute path -> parsed facts. Scoped to this context, never global. */
  astCache: AstFactsCache;
}

export function createRuleContext(files: FileAnalysis[]): RuleContext {
  const sources = new Map<string, string>();
  for (const file of files) {
    try {
      sources.set(file.relativePath, readFileSync(file.path, 'utf8'));
    } catch {
      // Unreadable files are skipped; the scan already reported them.
    }
  }
  return { files, sources, astCache: createAstFactsCache() };
}

export function runRules(skill: ArchitectureSkill, context: RuleContext): RuleViolation[] {
  const violations: RuleViolation[] = [];

  for (const antiPattern of skill.antiPatterns) {
    if (!antiPattern.detect) continue;
    violations.push(...runRule(antiPattern, antiPattern.detect, context));
  }

  return dedupe(violations.sort(compareViolations));
}

/**
 * Two rules can legitimately overlap on one line (a client component reading a
 * server secret is both a leak and a scattered env read). Report the most
 * severe one only — duplicate findings on a single line read as a bug.
 */
function dedupe(violations: RuleViolation[]): RuleViolation[] {
  const seen = new Set<string>();
  const result: RuleViolation[] = [];

  for (const violation of violations) {
    const key = `${violation.file}:${violation.line}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(violation);
  }

  return result;
}

function runRule(antiPattern: AntiPattern, detect: DetectSpec, context: RuleContext): RuleViolation[] {
  const scoped = context.files.filter(
    (file) => matchesAnyGlob(file.relativePath, detect.paths)
      && !(detect.notPaths ?? []).some((pattern) => matchesGlob(file.relativePath, pattern))
  );

  switch (detect.kind) {
    case 'import':
      return matchImport(antiPattern, detect, scoped);
    case 'import_direction':
      return matchImportDirection(antiPattern, detect, context);
    case 'metric':
      return matchMetric(antiPattern, detect, scoped);
    case 'directive':
    case 'call':
    case 'member':
    case 'throw':
      return matchAst(antiPattern, detect, scoped, context);
    default:
      return [];
  }
}

/** A numeric file metric exceeding its ceiling. */
function matchMetric(antiPattern: AntiPattern, detect: DetectSpec, files: FileAnalysis[]): RuleViolation[] {
  if (detect.metric !== 'loc' || typeof detect.gt !== 'number') return [];

  return files
    .filter((file) => file.loc > detect.gt!)
    .map((file) => violation(antiPattern, detect, file.relativePath, 1));
}

/** Directive, call, member and throw matchers, all driven off a real parse. */
function matchAst(
  antiPattern: AntiPattern,
  detect: DetectSpec,
  files: FileAnalysis[],
  context: RuleContext
): RuleViolation[] {
  const violations: RuleViolation[] = [];

  for (const file of files) {
    const source = context.sources.get(file.relativePath);
    if (source === undefined) continue;

    const facts = extractAstFacts(file.path, source, context.astCache);

    if (detect.requiresDirective && !facts.directives.includes(detect.requiresDirective)) continue;
    if (detect.requiresCall && !facts.calls.some((call) => call.name === detect.requiresCall)) continue;

    if (detect.kind === 'directive') {
      if (detect.value && facts.directives.includes(detect.value)) {
        violations.push(violation(antiPattern, detect, file.relativePath, 1));
      }
      continue;
    }

    if (detect.kind === 'call') {
      const names = detect.callee ?? [];
      for (const call of facts.calls) {
        if (!names.includes(call.name)) continue;
        violations.push(violation(antiPattern, detect, file.relativePath, call.line));
      }
      continue;
    }

    if (detect.kind === 'member') {
      for (const member of facts.members) {
        if (detect.object && member.object !== detect.object) continue;
        if (detect.property && member.property !== detect.property) continue;
        if (isExcluded(member.text, detect.notMatching)) continue;
        violations.push(violation(antiPattern, detect, file.relativePath, member.line));
      }
      continue;
    }

    if (detect.kind === 'throw') {
      for (const thrown of facts.throws) {
        violations.push(violation(antiPattern, detect, file.relativePath, thrown.line));
      }
    }
  }

  return violations;
}

function isExcluded(text: string, notMatching: string[] | undefined): boolean {
  if (!notMatching || notMatching.length === 0) return false;
  return notMatching.some((prefix) => text.startsWith(prefix));
}

/** A bare module specifier that must not be imported inside `paths`. */
function matchImport(antiPattern: AntiPattern, detect: DetectSpec, files: FileAnalysis[]): RuleViolation[] {
  const modules = detect.modules ?? [];
  const violations: RuleViolation[] = [];

  for (const file of files) {
    for (const imported of file.imports) {
      if (!modules.some((module) => moduleMatches(imported.source, module))) continue;
      violations.push(violation(antiPattern, detect, file.relativePath, imported.line));
    }
  }

  return violations;
}

/** Files under `from` may not import files under `to`. */
function matchImportDirection(antiPattern: AntiPattern, detect: DetectSpec, context: RuleContext): RuleViolation[] {
  if (!detect.from || !detect.to) return [];
  const violations: RuleViolation[] = [];

  for (const file of context.files) {
    if (!matchesGlob(file.relativePath, detect.from)) continue;

    for (const imported of file.imports) {
      const target = resolveImportTarget(file.relativePath, imported.source);
      if (!target || !matchesGlob(target, detect.to)) continue;
      violations.push(violation(antiPattern, detect, file.relativePath, imported.line));
    }
  }

  return violations;
}

/**
 * Resolve an import to a repo-relative path for direction checks.
 * Handles relative specifiers and the `@/` alias convention; anything else
 * (a bare package) is not a project file and is ignored.
 */
function resolveImportTarget(fromFile: string, source: string): string | null {
  if (source.startsWith('@/')) {
    return source.slice(2);
  }

  if (!source.startsWith('.')) {
    return null;
  }

  const segments = fromFile.split('/').slice(0, -1);
  for (const part of source.split('/')) {
    if (part === '.' || part === '') continue;
    if (part === '..') segments.pop();
    else segments.push(part);
  }

  return segments.join('/');
}

/** `prisma` matches `prisma` and `@prisma/client`; `pg` does not match `pg-format`. */
function moduleMatches(source: string, module: string): boolean {
  if (source === module) return true;
  if (source.startsWith(`${module}/`)) return true;
  return false;
}

function violation(antiPattern: AntiPattern, detect: DetectSpec, file: string, line: number): RuleViolation {
  return {
    rule: antiPattern.id,
    severity: antiPattern.severity,
    file,
    line,
    message: detect.message,
    fix: detect.fix
  };
}

const SEVERITY_ORDER: Record<RuleViolation['severity'], number> = { critical: 0, warning: 1, info: 2 };

function compareViolations(left: RuleViolation, right: RuleViolation): number {
  return (
    SEVERITY_ORDER[left.severity] - SEVERITY_ORDER[right.severity]
    || left.file.localeCompare(right.file)
    || left.line - right.line
    || left.rule.localeCompare(right.rule)
  );
}
