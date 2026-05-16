import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

interface PackageJson {
  name: string;
  version: string;
  description: string;
  bin: Record<string, string>;
  files: string[];
  engines: Record<string, string>;
  keywords: string[];
  license: string;
}

interface PackFile {
  path: string;
}

interface PackResult {
  files: PackFile[];
}

function readPackageJson(): PackageJson {
  return JSON.parse(readFileSync(path.resolve('package.json'), 'utf8')) as PackageJson;
}

function readProjectFile(relativePath: string): string {
  return readFileSync(path.resolve(relativePath), 'utf8');
}

function dryRunPackFiles(): string[] {
  const output = execFileSync('npm', ['pack', '--dry-run', '--json'], {
    cwd: process.cwd(),
    encoding: 'utf8'
  });
  const [pack] = JSON.parse(output) as PackResult[];

  return pack.files.map((file) => `package/${file.path}`);
}

describe('package readiness', () => {
  it('declares release-ready package metadata', () => {
    const packageJson = readPackageJson();

    expect(packageJson.name).toBe('architect-cli');
    expect(packageJson.bin).toEqual({ architect: 'dist/cli/index.js' });
    expect(packageJson.engines.node).toBe('>=20.0.0');
    expect(packageJson.files).toEqual(expect.arrayContaining(['dist', 'skills', 'README.md', 'CHANGELOG.md', 'CONTRIBUTING.md']));
    expect(packageJson.license).toBe('MIT');
    expect(packageJson.description).toContain('Structural health scanner');
    expect(packageJson.keywords).toEqual(expect.arrayContaining(['architecture', 'code-quality', 'refactoring', 'cli', 'vibe-coding', 'vibe-coded']));
  });

  it('keeps generated package artifacts and development files out of npm output', () => {
    const npmignore = readProjectFile('.npmignore');

    for (const pattern of ['src/', 'tests/', '*.tgz', '.env*', '*.log', 'coverage/', 'tsconfig.json', 'eslint.config.mjs']) {
      expect(npmignore).toContain(pattern);
    }
  });

  it('keeps release validation sections ready for audit trail updates', () => {
    const releaseValidation = readProjectFile('docs/RELEASE_VALIDATION.md');

    expect(releaseValidation).toContain('## Package Name Status');
    expect(releaseValidation).toContain('## Local Validation Results');
    expect(releaseValidation).toContain('## Artifact Inspection Result');
    expect(releaseValidation).toContain('## Install Validation Result');
    expect(releaseValidation).toContain('## Publish Outcome');
    expect(releaseValidation).toContain('## Post-Publish Validation Result');
    expect(releaseValidation).toContain('## Release Blockers');
  });

  it('has a compiled CLI entry after build', () => {
    const cliEntry = path.resolve('dist/cli/index.js');
    const cliSource = readFileSync(path.resolve('src/cli/index.ts'), 'utf8');

    expect(existsSync(cliEntry)).toBe(true);
    expect(readFileSync(cliEntry, 'utf8').startsWith('#!/usr/bin/env node')).toBe(true);
    expect(cliSource).toContain('realpathSync(process.argv[1])');
  });

  it('dry-run package contents include runtime assets and exclude forbidden files', () => {
    const files = dryRunPackFiles();

    expect(files).toContain('package/package.json');
    expect(files).toContain('package/README.md');
    expect(files).toContain('package/CHANGELOG.md');
    expect(files).toContain('package/CONTRIBUTING.md');
    expect(files).toContain('package/dist/cli/index.js');
    expect(files.some((file) => file.startsWith('package/skills/'))).toBe(true);

    for (const forbidden of ['package/src/', 'package/tests/', '.tgz', '.env', 'eslint.config', 'tsconfig.json', 'vitest.config']) {
      expect(files.some((file) => file.includes(forbidden))).toBe(false);
    }
  });

  it('records package-name, publish, blocker, and post-publish sections', () => {
    const releaseValidation = readProjectFile('docs/RELEASE_VALIDATION.md');

    expect(releaseValidation).toContain('- Status:');
    expect(releaseValidation).toContain('- Auth status:');
    expect(releaseValidation).toContain('- Version availability:');
    expect(releaseValidation).toContain('- Publish command:');
    expect(releaseValidation).toContain('## Release Blockers');
    expect(releaseValidation).toContain('- Registry version:');
    expect(releaseValidation).toContain('- Clean-environment command:');
  });
});
