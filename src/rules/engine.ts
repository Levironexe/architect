import { readFileSync } from 'node:fs';

import type { FileAnalysis } from '../types/analysis.js';
import type { DetectSpec, RuleViolation } from '../types/rule.js';
import type { AntiPattern, ArchitectureSkill } from '../types/skill.js';
import { createAstFactsCache, extractAstFacts, type AstFactsCache } from './ast-facts.js';
import { matchesAnyGlob, matchesGlob } from './glob.js';
import { findWorkspacePackages, type WorkspacePackage } from './workspace.js';

export interface RuleContext {
  files: FileAnalysis[];
  /** Repo-relative path -> source text. Read once, shared by every matcher. */
  sources: Map<string, string>;
  /** Absolute path -> parsed facts. Scoped to this context, never global. */
  astCache: AstFactsCache;
  /** Package name -> workspace package, for the one-hop import match. */
  workspace: Map<string, WorkspacePackage>;
  /** Path-without-extension -> file, for resolving local imports to a file. */
  byStem: Map<string, FileAnalysis>;
}

export function createRuleContext(files: FileAnalysis[], rootDir?: string): RuleContext {
  const sources = new Map<string, string>();
  const byStem = new Map<string, FileAnalysis>();

  for (const file of files) {
    try {
      sources.set(file.relativePath, readFileSync(file.path, 'utf8'));
    } catch {
      // Unreadable files are skipped; the scan already reported them.
    }
    const stem = file.relativePath.replace(/\.[^/.]+$/, '');
    byStem.set(stem, file);
    if (/\/index$/.test(stem)) byStem.set(stem.replace(/\/index$/, ''), file);
  }

  const root = rootDir ?? deriveRoot(files);
  const workspace = root ? findWorkspacePackages(root) : new Map<string, WorkspacePackage>();

  return { files, sources, astCache: createAstFactsCache(), workspace, byStem };
}

function deriveRoot(files: FileAnalysis[]): string | null {
  const first = files[0];
  if (!first) return null;
  return first.path.slice(0, first.path.length - first.relativePath.length).replace(/\/$/, '') || null;
}

export function runRules(skill: ArchitectureSkill, context: RuleContext): RuleViolation[] {
  const violations: RuleViolation[] = [];

  for (const antiPattern of skill.antiPatterns) {
    if (!antiPattern.detect) continue;
    violations.push(...runRule(antiPattern, antiPattern.detect, context));
  }

  return dedupe(violations.sort(compareViolations)).filter((violation) => !isIgnoredInSource(violation, context));
}

/**
 * `// architect-ignore-next-line` above a line, or `// architect-ignore-file`
 * anywhere in the first ten lines, suppresses a finding at the source.
 */
function isIgnoredInSource(violation: RuleViolation, context: RuleContext): boolean {
  const source = context.sources.get(violation.file);
  if (!source) return false;
  const lines = source.split('\n');

  if (lines.slice(0, 10).some((line) => line.includes('architect-ignore-file'))) return true;

  const previous = lines[violation.line - 2];
  return violation.line > 1 && previous !== undefined && previous.includes('architect-ignore-next-line');
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
      return matchImport(antiPattern, detect, scoped, context);
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
    .map((file) => {
      const found = violation(antiPattern, detect, file.relativePath, 1);
      found.message = found.message
        .replace('{value}', String(file.loc))
        .replace('{limit}', String(detect.gt));
      return found;
    });
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
function matchImport(
  antiPattern: AntiPattern,
  detect: DetectSpec,
  files: FileAnalysis[],
  context: RuleContext
): RuleViolation[] {
  const modules = detect.modules ?? [];
  const violations: RuleViolation[] = [];

  for (const file of files) {
    for (const imported of file.imports) {
      const direct = modules.some((module) => moduleMatches(imported.source, module));
      if (direct || importsClientOneHopAway(imported, file, detect, context)) {
        violations.push(violation(antiPattern, detect, file.relativePath, imported.line));
      }
    }
  }

  return violations;
}

/**
 * `import { prisma } from '@acme/db'` is a database client in a page even though
 * the specifier is not '@prisma/client'. Follow exactly one hop: a workspace
 * package whose package.json depends on a listed module, or a local file that
 * imports one. The binding name is what separates a client from a helper —
 * `import { listUsers } from '@/lib/users'` is the pattern the rule wants.
 */
function importsClientOneHopAway(
  imported: FileAnalysis['imports'][number],
  from: FileAnalysis,
  detect: DetectSpec,
  context: RuleContext
): boolean {
  const bindings = detect.bindings ?? [];
  const modules = detect.modules ?? [];
  if (bindings.length === 0 || modules.length === 0) return false;
  if (imported.isTypeOnly) return false;
  if (!imported.specifiers.some((name) => bindings.includes(name.toLowerCase()))) return false;

  // Hop 1a: a workspace package, identified by its own dependencies.
  const pkg = context.workspace.get(imported.source);
  if (pkg) {
    return [...pkg.deps].some((dep) => modules.some((module) => moduleMatches(dep, module)));
  }

  // Hop 1b: a local file, identified by what it imports.
  const target = resolveImportTarget(from.relativePath, imported.source);
  if (!target) return false;
  const targetFile = findByStem(target, context);
  if (!targetFile) return false;
  return targetFile.imports.some((entry) => modules.some((module) => moduleMatches(entry.source, module)));
}

/** `@/lib/db` resolves to `lib/db`, which lives at `src/lib/db.ts` in most projects. */
function findByStem(target: string, context: RuleContext): FileAnalysis | undefined {
  const exact = context.byStem.get(target);
  if (exact) return exact;
  const suffix = `/${target}`;
  for (const [stem, file] of context.byStem) {
    if (stem.endsWith(suffix)) return file;
  }
  return undefined;
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
      // A project may nest components/ and lib/ inside app/. Importing a
      // sibling layer is not a direction violation — only reaching into a
      // route segment is.
      if ((detect.notTo ?? []).some((pattern) => matchesGlob(target, pattern))) continue;
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
