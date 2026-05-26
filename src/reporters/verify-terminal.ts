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

  if (result.duplication_delta > 1) {
    lines.push(`  ${chalk.yellow('⚠')} Duplication increased     (+${result.duplication_delta}%)`);
  } else {
    lines.push(checkLine(chalk, true, 'Duplication stable', `(${result.duplication_delta >= 0 ? '+' : ''}${result.duplication_delta}%)`));
  }

  lines.push(checkLine(chalk, result.health_delta >= 0, 'Health score', `(${result.health_delta >= 0 ? '+' : ''}${result.health_delta})`));

  lines.push('');

  if (result.passed) {
    const phaseLabel = result.phase ? `Phase ${result.phase} verification` : 'Verification';
    lines.push(chalk.green(`${phaseLabel}: PASSED`));
  } else {
    lines.push(chalk.red(`Verification: FAILED`));
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
    if (result.compilation_errors === 0 && result.broken_imports.length === 0) {
      lines.push('');
      lines.push('Strict mode failures:');
      if (result.new_circular_deps > 0) lines.push(`  ${chalk.red('→')} New circular dependencies introduced (+${result.new_circular_deps})`);
      if (result.duplication_delta > 1) lines.push(`  ${chalk.red('→')} Duplication increased by ${result.duplication_delta}%`);
      if (result.health_delta < 0) lines.push(`  ${chalk.red('→')} Health score regressed (${result.health_delta})`);
    }
  }

  lines.push('');
  return lines.join('\n');
}

function checkLine(chalk: InstanceType<typeof Chalk>, passed: boolean, label: string, detail: string): string {
  const icon = passed ? chalk.green('✓') : chalk.red('✗');
  return `  ${icon} ${label.padEnd(24)} ${detail}`;
}
