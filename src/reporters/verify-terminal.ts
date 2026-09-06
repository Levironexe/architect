import { Chalk } from 'chalk';
import type { VerifyResult } from '../types/state.js';

export function renderVerifyReport(result: VerifyResult, options: { color?: boolean } = {}): string {
  const chalk = new Chalk({ level: options.color !== false ? 1 : 0 });
  const lines: string[] = [];

  const header = result.phase_name
    ? `Verifying Phase ${result.phase}: ${result.phase_name}`
    : 'Verification Results';

  lines.push(chalk.bold(header));
  lines.push('');

  lines.push(checkLine(chalk, result.compilation_errors === 0, result.compilation_label, `(${result.compilation_errors} errors)`));
  lines.push(checkLine(chalk, result.broken_imports.length === 0, 'Import resolution', `(${result.broken_imports.length} broken imports)`));
  lines.push(checkLine(chalk, result.new_circular_deps <= 0, 'No new circular deps', `(${result.new_circular_deps >= 0 ? '+' : ''}${result.new_circular_deps})`));

  if (result.baseline_violations === null) {
    lines.push(`  ${chalk.dim('·')} Violations              ${chalk.dim(`(${result.violations}, no baseline recorded)`)}`);
  } else {
    const delta = result.new_violations >= 0 ? `+${result.new_violations}` : `${result.new_violations}`;
    lines.push(checkLine(
      chalk,
      result.new_violations <= 0,
      'Violations vs baseline',
      `(${result.violations} now, ${result.baseline_violations} at baseline, ${delta})`
    ));
  }



  if (result.plan_checks_total > 0) {
    const passedCount = result.plan_checks_total - result.plan_checks_failed.length;
    lines.push(checkLine(chalk, result.plan_checks_failed.length === 0, 'Plan verify checks', `(${passedCount}/${result.plan_checks_total} passed)`));
  }

  lines.push('');

  if (result.passed) {
    const phaseLabel = result.phase ? `Phase ${result.phase} verification` : 'Verification';
    lines.push(chalk.green(`${phaseLabel}: PASSED`));
  } else {
    lines.push(chalk.red(`Verification: FAILED`));
    if (result.new_violations > 0) {
      lines.push('');
      lines.push(`${result.new_violations} new architectural violation(s) since the baseline. Run architect check for detail.`);
    }
    if (result.broken_imports.length > 0) {
      lines.push('');
      lines.push('Broken imports:');
      for (const imp of result.broken_imports.slice(0, 10)) {
        lines.push(`  ${chalk.red('→')} ${imp}`);
      }
      if (result.broken_imports.length > 10) {
        lines.push(`  ... and ${result.broken_imports.length - 10} more`);
      }
    }
    if (result.plan_checks_failed.length > 0) {
      lines.push('');
      lines.push('Failed plan checks:');
      for (const failure of result.plan_checks_failed.slice(0, 5)) {
        lines.push(`  ${chalk.red('→')} ${failure.step}: ${failure.command}`);
        for (const outputLine of failure.output.split('\n')) {
          lines.push(`    ${outputLine}`);
        }
      }
      if (result.plan_checks_failed.length > 5) {
        lines.push(`  ... and ${result.plan_checks_failed.length - 5} more`);
      }
    }
    if (result.compilation_errors === 0 && result.broken_imports.length === 0 && result.plan_checks_failed.length === 0) {
      lines.push('');
      lines.push('Strict mode failures:');
      if (result.new_circular_deps > 0) lines.push(`  ${chalk.red('→')} New circular dependencies introduced (+${result.new_circular_deps})`);
    }
  }

  lines.push('');
  return lines.join('\n');
}

function checkLine(chalk: InstanceType<typeof Chalk>, passed: boolean, label: string, detail: string): string {
  const icon = passed ? chalk.green('✓') : chalk.red('✗');
  return `  ${icon} ${label.padEnd(24)} ${detail}`;
}
