import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { runCli } from '../../../src/cli/index';
import { captureOutput } from '../test-helpers';

describe('metrics-only scan behavior', () => {
  it('completes scan without any API keys and reports a health score', async () => {
    const fixturePath = path.resolve('tests/fixtures/messy-express');

    const output = await captureOutput(async () => {
      expect(await runCli(['scan', fixturePath, '--no-color'])).toBe(0);
    });

    expect(output.stdout).toContain('Health report');
    expect(output.stdout).toContain('Overall score:');
    expect(output.stdout).toContain('modularity:');
    expect(output.stdout).toContain('duplication:');
  });

  it('does not mention LLM, concern classification, or architect plan', async () => {
    const fixturePath = path.resolve('tests/fixtures/messy-express');

    const output = await captureOutput(async () => {
      await runCli(['scan', fixturePath, '--no-color']);
    });

    expect(output.stdout).not.toContain('AI provider');
    expect(output.stdout).not.toContain('Concern classification');
    expect(output.stdout).not.toContain('Pattern consistency');
    expect(output.stdout).not.toContain('architect plan');
  });

  it('outputs only modularity and duplication dimensions in JSON mode', async () => {
    const fixturePath = path.resolve('tests/fixtures/messy-express');

    const output = await captureOutput(async () => {
      await runCli(['scan', fixturePath, '--json']);
    });

    const json = JSON.parse(output.stdout);
    const scores = json.result?.scores;
    expect(scores).toBeDefined();
    expect(scores.modularity).toBeDefined();
    expect(scores.duplication).toBeDefined();
    expect(scores.overall).toBeGreaterThan(0);
    expect(scores.separation).toBeUndefined();
    expect(scores.consistency).toBeUndefined();
  });
});
