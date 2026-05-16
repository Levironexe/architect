import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

function readProjectFile(relativePath: string): string {
  return readFileSync(path.resolve(relativePath), 'utf8');
}

describe('public documentation readiness', () => {
  it('documents README essentials for first-time users', () => {
    const readme = readProjectFile('README.md');

    expect(readme).toContain('## Installation');
    expect(readme).toContain('npm install -g architect-cli');
    expect(readme).toContain('## Quick Start');
    expect(readme).toContain('## Command Reference');
    expect(readme).toContain('--threshold');
    expect(readme).toContain('--provider');
    expect(readme).toContain('--json');
    expect(readme).toContain('--verbose');
    expect(readme).toContain('--no-color');
    expect(readme).toContain('## Scoring Model');
    expect(readme).toContain('## LLM Provider Setup');
    expect(readme).toContain('## Example Output');
    expect(readme).toContain('## Contributing');
    expect(readme).toContain('## License');
  });

  it('provides contribution and changelog guidance', () => {
    const contributing = readProjectFile('CONTRIBUTING.md');
    const changelog = readProjectFile('CHANGELOG.md');

    expect(contributing).toContain('## Local Setup');
    expect(contributing).toContain('npm run build');
    expect(contributing).toContain('npm run lint');
    expect(contributing).toContain('npm test');
    expect(contributing).toContain('## Pull Requests');
    expect(changelog).toContain('## Unreleased');
    expect(changelog).toContain('### Added');
    expect(changelog).toContain('### Security');
  });

  it('provides issue templates and nested CLI CI workflow', () => {
    const bugTemplate = readProjectFile('.github/ISSUE_TEMPLATE/bug_report.md');
    const featureTemplate = readProjectFile('.github/ISSUE_TEMPLATE/feature_request.md');
    const workflowPath = path.resolve('../.github/workflows/architect-cli-ci.yml');
    const workflow = readFileSync(workflowPath, 'utf8');

    expect(bugTemplate).toContain('## Command or Workflow');
    expect(bugTemplate).toContain('## Reproduction Steps');
    expect(bugTemplate).toContain('## Environment');
    expect(bugTemplate).toContain('secrets removed');
    expect(featureTemplate).toContain('## User Problem');
    expect(featureTemplate).toContain('## Desired Behavior');
    expect(featureTemplate).toContain('## Impact or Priority');
    expect(existsSync(workflowPath)).toBe(true);
    expect(workflow).toContain('working-directory: architect-cli');
    expect(workflow).toContain('npm run build');
    expect(workflow).toContain('npm run lint');
    expect(workflow).toContain('npm test');
    expect(workflow).toContain('npm audit --audit-level=high');
  });
});
