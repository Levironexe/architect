import { useA } from './feature/a';
import { renderReport } from './feature/report';
import { formatName } from './shared/format';

export function runDependencyFixture(): string {
  return renderReport(formatName(useA('architect')));
}