import { formatName } from '../shared/format';

export function renderReport(value: string): string {
  return formatName(`report:${value}`);
}