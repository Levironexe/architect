import type { IssueSeverity } from './skill.js';

/**
 * Matcher kinds a blueprint anti-pattern can declare in its `detect:` block.
 *
 * A rule without `detect:` is agent-only guidance: it stays in the blueprint
 * for the coding agent to read, but `architect check` never reports it.
 */
export type DetectKind =
  | 'import'
  | 'import_direction'
  | 'directive'
  | 'call'
  | 'member'
  | 'throw'
  | 'metric';

export interface DetectSpec {
  kind: DetectKind;

  /** Globs the rule applies to, matched against the repo-relative path. */
  paths?: string[];
  /** Globs excluded from the rule, applied after `paths`. */
  notPaths?: string[];

  /** kind: import — bare module specifiers that must not be imported here. */
  modules?: string[];

  /** kind: import_direction — files under `from` may not import from `to`. */
  from?: string;
  to?: string;
  /** Targets matching any of these are allowed, even if they match `to`. */
  notTo?: string[];

  /** kind: directive — the directive prologue to look for, e.g. "use client". */
  value?: string;

  /** kind: call — callee names, e.g. ["alert"]. */
  callee?: string[];

  /** kind: member — an object/property pair, e.g. process.env. */
  object?: string;
  property?: string;

  /** Extra guards: the file must also carry this directive / contain this call. */
  requiresDirective?: string;
  requiresCall?: string;

  /** Matched text starting with any of these is not a violation. */
  notMatching?: string[];

  /** kind: metric — a numeric file metric and its ceiling. */
  metric?: 'loc';
  gt?: number;

  /** Reported to the user. `fix` states the move, not the diagnosis. */
  message: string;
  fix: string;
}

export interface RuleViolation {
  rule: string;
  severity: IssueSeverity;
  file: string;
  line: number;
  message: string;
  fix: string;
}

export interface CheckResult {
  stack: string | null;
  filesChecked: number;
  violations: RuleViolation[];
  summary: { critical: number; warning: number; info: number };
}
