import { describe, expect, it } from 'vitest';

import { renderPlanJson } from '../../../src/formatters/plan-json';
import { renderPlanMarkdown } from '../../../src/formatters/plan-markdown';
import { renderPlanTerminal } from '../../../src/formatters/plan-terminal';
import { createPlanFixture } from '../planner/plan-fixtures';

describe('plan formatter invariants', () => {
  it('preserves phase and step counts across structured formatters', () => {
    const plan = createPlanFixture();
    const json = JSON.parse(renderPlanJson(plan)) as ReturnType<typeof createPlanFixture>;
    const markdown = renderPlanMarkdown(plan);
    const terminal = renderPlanTerminal(plan, { color: false });
    const phaseCount = plan.phases.length;
    const stepCount = plan.phases.flatMap((phase) => phase.steps).length;

    expect(json.phases).toHaveLength(phaseCount);
    expect(json.phases.flatMap((phase) => phase.steps)).toHaveLength(stepCount);
    const markdownPhaseHeadings = markdown
      .split('\n')
      .filter((line) => line.startsWith('## ') && !['## Assumptions', '## Validation Findings'].includes(line));
    expect(markdownPhaseHeadings).toHaveLength(phaseCount);
    expect(markdown.match(/^- \[ \] \*\*/gm)).toHaveLength(stepCount);
    expect((terminal.match(/^\d+\. \[/gm) ?? [])).toHaveLength(stepCount);
  });
});
