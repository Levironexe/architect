import { Chalk } from 'chalk';
import type { DiffMetric } from '../types/state.js';

export function renderDiffReport(metrics: DiffMetric[], options: { color?: boolean } = {}): string {
  const chalk = new Chalk({ level: options.color !== false ? 1 : 0 });
  const lines: string[] = [];

  lines.push(chalk.bold('Architect Scan Comparison'));
  lines.push('');

  const labelWidth = Math.max(...metrics.map((m) => m.label.length), 16);

  lines.push(
    `${''.padEnd(labelWidth)}  ${'Before'.padStart(10)}  ${'After'.padStart(10)}  ${'Delta'.padStart(10)}`
  );
  lines.push('─'.repeat(labelWidth + 36));

  for (const metric of metrics) {
    const beforeStr = formatValue(metric.before, metric.unit);
    const afterStr = formatValue(metric.after, metric.unit);
    const deltaStr = formatDelta(metric.delta, metric.unit);

    const coloredDelta = metric.delta < 0
      ? chalk.green(deltaStr)
      : metric.delta > 0
        ? chalk.red(deltaStr)
        : chalk.gray(deltaStr);

    lines.push(
      `${metric.label.padEnd(labelWidth)}  ${beforeStr.padStart(10)}  ${afterStr.padStart(10)}  ${coloredDelta}`
    );
  }

  lines.push('');
  return lines.join('\n');
}

function formatValue(value: number | string, unit?: string): string {
  if (typeof value === 'string') return value;
  if (unit === '%') return `${value}%`;
  return String(value);
}

function formatDelta(delta: number, unit?: string): string {
  if (delta === 0) return '  0';
  const sign = delta > 0 ? '+' : '';
  const suffix = unit === '%' ? '%' : '';
  const arrow = delta < 0 ? ' ▼' : ' ▲';
  return `${sign}${delta}${suffix}${arrow}`;
}
