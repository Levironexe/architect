import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { runCli, runProjectScan } from '../../../src/cli/index';
import { captureOutput } from '../test-helpers';

describe('scan command', () => {
  it('reports a nonexistent target directory on stderr with exit code 3', async () => {
    const output = await captureOutput(async () => {
      const exitCode = await runCli(['scan', 'does-not-exist']);
      expect(exitCode).toBe(3);
    });

    expect(output.stdout).toBe('');
    expect(output.stderr).toContain('Target directory does not exist');
  });

  it('prints a summary with flagged function counts for a fixture project', async () => {
    const fixturePath = path.resolve('tests/fixtures/messy-express');

    const output = await captureOutput(async () => {
      const exitCode = await runCli(['scan', fixturePath]);
      expect(exitCode).toBe(0);
    });

    expect(output.stderr).toBe('');
    expect(output.stdout).toContain('FILE');
    expect(output.stdout).toContain('server.ts');
    expect(output.stdout).toContain('Critical functions');
    expect(output.stdout).toContain('- Flagged functions: 1');
  });

  it('preserves summary content without ANSI codes when --no-color is used', async () => {
    const fixturePath = path.resolve('tests/fixtures/messy-express');

    const output = await captureOutput(async () => {
      const exitCode = await runCli(['scan', fixturePath, '--no-color']);
      expect(exitCode).toBe(0);
    });

    expect(output.stderr).toBe('');
    expect(output.stdout).toContain('OVERSIZED');
    expect(output.stdout).toContain('- Flagged functions: 1');
    expect(output.stdout).not.toContain('\u001b[');
  });

  it('continues through broken files and reports skipped files in the summary', async () => {
    const fixturePath = path.resolve('tests/fixtures/broken-project');

    const output = await captureOutput(async () => {
      const exitCode = await runCli(['scan', fixturePath, '--no-color']);
      expect(exitCode).toBe(0);
    });

    expect(output.stdout).toContain('Summary');
    expect(output.stdout).toContain('- Files scanned: 0');
    expect(output.stdout).toContain('- Flagged functions: 0');
    expect(output.stdout).toContain('- Skipped files: 1');
    expect(output.stderr).toContain('WARN  Failed to parse broken.ts');
  });

  it('reports zero supported files as a successful scan', async () => {
    const fixturePath = path.resolve('tests/fixtures/empty-project');

    const output = await captureOutput(async () => {
      const exitCode = await runCli(['scan', fixturePath]);
      expect(exitCode).toBe(0);
    });

    expect(output.stderr).toBe('');
    expect(output.stdout).toContain('No supported JS/TS files found');
  });

  it('prints dependency insights for the dependency graph fixture', async () => {
    const fixturePath = path.resolve('tests/fixtures/dependency-graph-project');

    const output = await captureOutput(async () => {
      const exitCode = await runCli(['scan', fixturePath, '--no-color']);
      expect(exitCode).toBe(0);
    });

    expect(output.stdout).toContain('Dependency insights');
    expect(output.stdout).toContain('Hotspot: src/shared/format.ts (depended on by 3 files)');
    expect(output.stdout).toContain('Circular dependency: src/feature/a.ts -> src/feature/b.ts -> src/feature/a.ts');
    expect(output.stdout).toContain('Unreferenced: src/unused.ts');
  });

  it('prints duplication findings for the duplication fixture', async () => {
    const fixturePath = path.resolve('tests/fixtures/duplicate-blocks-project');

    const output = await captureOutput(async () => {
      const exitCode = await runCli(['scan', fixturePath, '--no-color']);
      expect(exitCode).toBe(0);
    });

    expect(output.stdout).toContain('Duplication findings');
    expect(output.stdout).toContain('src/a.ts');
    expect(output.stdout).toContain('src/b.ts');
    expect(output.stdout).toContain('- Duplicate findings: 1');
    expect(output.stdout).toContain('- Duplicated lines:');
  });

  it('reports partial structural findings when skipped files may affect the result', async () => {
    const fixturePath = path.resolve('tests/fixtures/broken-project');

    const output = await captureOutput(async () => {
      const exitCode = await runCli(['scan', fixturePath, '--no-color']);
      expect(exitCode).toBe(0);
    });

    expect(output.stdout).toContain('Dependency insights');
    expect(output.stdout).toContain('Duplication findings');
    expect(output.stderr).toContain('Dependency and duplication findings may be partial');
  });

  it('prints detected architecture for a matching fixture', async () => {
    const fixturePath = path.resolve('tests/fixtures/messy-express');

    const output = await captureOutput(async () => {
      const exitCode = await runCli(['scan', fixturePath, '--no-color']);
      expect(exitCode).toBe(0);
    });

    expect(output.stdout).toContain('Detected architecture');
    expect(output.stdout).toContain('Primary: Express.js REST API (express-api) [high confidence]');
    expect(output.stdout).toContain('Secondary: General JavaScript/TypeScript (general-js)');
  });

  it('prints missing Express structure for a matching fixture', async () => {
    const fixturePath = path.resolve('tests/fixtures/messy-express');

    const output = await captureOutput(async () => {
      const exitCode = await runCli(['scan', fixturePath, '--no-color']);
      expect(exitCode).toBe(0);
    });

    expect(output.stdout).toContain('Structure comparison');
    expect(output.stdout).toContain('missing  src/routes');
    expect(output.stdout).toContain('missing  src/controllers');
    expect(output.stdout).toContain('missing  src/services');
  });

  it('prints health score output with only modularity and duplication dimensions', async () => {
    const fixturePath = path.resolve('tests/fixtures/messy-express');

    const output = await captureOutput(async () => {
      const exitCode = await runCli(['scan', fixturePath, '--no-color']);
      expect(exitCode).toBe(0);
    });

    expect(output.stdout).toContain('Health report');
    expect(output.stdout).toContain('Overall score:');
    expect(output.stdout).toContain('modularity:');
    expect(output.stdout).toContain('duplication:');
    expect(output.stdout).not.toContain('separation');
    expect(output.stdout).not.toContain('consistency');
  });

  it('prints React and no-primary fixture skill-aware states', async () => {
    const reactFixturePath = path.resolve('tests/fixtures/decent-react');
    const cleanFixturePath = path.resolve('tests/fixtures/clean-project');

    const reactOutput = await captureOutput(async () => {
      const exitCode = await runCli(['scan', reactFixturePath, '--no-color']);
      expect(exitCode).toBe(0);
    });
    const cleanOutput = await captureOutput(async () => {
      const exitCode = await runCli(['scan', cleanFixturePath, '--no-color']);
      expect(exitCode).toBe(0);
    });

    expect(reactOutput.stdout).toContain('Primary: React Single Page Application (react-spa) [high confidence]');
    expect(cleanOutput.stdout).toContain('No confident primary architecture skill detected');
    expect(cleanOutput.stdout).toContain('Structure comparison');
    expect(cleanOutput.stdout).toContain('Unavailable because no primary architecture skill was detected');
  });

  it('exposes reusable scan results without rendering output', async () => {
    const fixturePath = path.resolve('tests/fixtures/messy-express');

    const output = await captureOutput(async () => {
      const result = await runProjectScan(fixturePath);

      expect(result.summary.totalFiles).toBeGreaterThan(0);
      expect(result.issues?.length).toBeGreaterThan(0);
    });

    expect(output.stdout).toBe('');
  });

  it('rejects --provider as an unknown option', async () => {
    const fixturePath = path.resolve('tests/fixtures/messy-express');

    const output = await captureOutput(async () => {
      const exitCode = await runCli(['scan', fixturePath, '--provider', 'claude']);
      expect(exitCode).not.toBe(0);
    });

    expect(output.stdout).toBe('');
  });
});
