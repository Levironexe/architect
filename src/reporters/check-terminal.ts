import { Chalk } from 'chalk';

import type { CheckResult, RuleViolation } from '../types/rule.js';
import type { ArchitectureSkill } from '../types/skill.js';

interface RenderOptions {
  color?: boolean;
}

export function renderCheckReport(result: CheckResult, options: RenderOptions = {}): void {
  const chalk = new Chalk({ level: options.color === false ? 0 : 1 });
  const lines: string[] = [];

  if (result.violations.length === 0) {
    lines.push(chalk.green('✓ No architectural violations.'));
    lines.push(chalk.dim(`  ${result.filesChecked} files checked against ${result.stack}`));
    process.stdout.write(`${lines.join('\n')}\n`);
    return;
  }

  for (const violation of result.violations) {
    lines.push(`${mark(chalk, violation)} ${location(chalk, violation)}`);
    lines.push(`    ${violation.message}`);
    lines.push(chalk.dim(`    → ${violation.fix}`));
    lines.push(chalk.dim(`      ${violation.rule}`));
    lines.push('');
  }

  const { critical, warning } = result.summary;
  const total = result.violations.length;
  lines.push(
    `${total} violation${total === 1 ? '' : 's'}`
    + ` (${critical} critical, ${warning} warning)`
    + chalk.dim(` · ${result.filesChecked} files checked · ${result.stack}`)
  );

  process.stdout.write(`${lines.join('\n')}\n`);
}

export function renderRuleList(skills: ArchitectureSkill[], options: RenderOptions = {}): void {
  const chalk = new Chalk({ level: options.color === false ? 0 : 1 });
  const lines: string[] = [];

  for (const skill of skills) {
    lines.push(chalk.bold(`${skill.name} (${skill.id})`));
    lines.push('');

    for (const antiPattern of skill.antiPatterns) {
      const checkable = Boolean(antiPattern.detect);
      const flag = checkable ? chalk.green('✓') : chalk.dim('·');
      const severity = antiPattern.severity === 'critical'
        ? chalk.red(antiPattern.severity.padEnd(8))
        : chalk.yellow(antiPattern.severity.padEnd(8));
      const suffix = checkable ? '' : chalk.dim(' (agent guidance only)');
      lines.push(`  ${flag} ${severity} ${antiPattern.id}${suffix}`);
    }

    lines.push('');
    lines.push(chalk.dim('  missing_layer is reported from the blueprint\'s required directories.'));
  }

  process.stdout.write(`${lines.join('\n')}\n`);
}

function mark(chalk: InstanceType<typeof Chalk>, violation: RuleViolation): string {
  return violation.severity === 'critical' ? chalk.red('✗') : chalk.yellow('⚠');
}

function location(chalk: InstanceType<typeof Chalk>, violation: RuleViolation): string {
  return violation.line > 0
    ? `${violation.file}${chalk.dim(`:${violation.line}`)}`
    : violation.file;
}
