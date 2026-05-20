import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { runInitCommand } from '../../../src/cli/init-runner';
import { captureOutput } from '../test-helpers';

describe('init-runner: language detection without package.json', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'architect-no-pkg-'));
    writeFileSync(path.join(tempDir, 'index.js'), 'const x = 1;', 'utf8');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('detects JS via extension fallback and still runs scan without package.json', async () => {
    const mockScanRunner = vi.fn().mockResolvedValue({
      summary: { totalFiles: 1 },
      matchedSkills: []
    });
    const mockSkillLoader = vi.fn().mockResolvedValue({ skills: [] });

    await captureOutput(async () => {
      await runInitCommand(tempDir, {}, {
        runProjectScan: mockScanRunner as never,
        loadSkills: mockSkillLoader as never
      }).catch(() => {});
    });

    expect(mockScanRunner).toHaveBeenCalledOnce();
  });

  it('detects JS via config file when package.json exists', async () => {
    writeFileSync(path.join(tempDir, 'package.json'), '{"name":"test"}', 'utf8');

    const mockScanRunner = vi.fn().mockResolvedValue({
      summary: { totalFiles: 1 },
      matchedSkills: []
    });
    const mockSkillLoader = vi.fn().mockResolvedValue({ skills: [] });

    await captureOutput(async () => {
      await runInitCommand(tempDir, {}, {
        runProjectScan: mockScanRunner as never,
        loadSkills: mockSkillLoader as never
      }).catch(() => {});
    });

    expect(mockScanRunner).toHaveBeenCalledOnce();
  });
});

describe('init-runner: large-project spinner', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'architect-large-'));
    writeFileSync(path.join(tempDir, 'package.json'), '{"name":"test"}', 'utf8');
    for (let i = 0; i < 10; i++) {
      writeFileSync(path.join(tempDir, `file${i}.js`), `const x = ${i};`, 'utf8');
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('starts and stops the spinner when file count exceeds 500', async () => {
    const start = vi.fn().mockReturnThis();
    const stop = vi.fn().mockReturnThis();
    const mockSpinnerFactory = vi.fn().mockReturnValue({ start, stop });

    const mockScanRunner = vi.fn().mockResolvedValue({
      summary: { totalFiles: 600 },
      matchedSkills: []
    });
    const mockSkillLoader = vi.fn().mockResolvedValue({ skills: [] });

    // Write 501+ files to trigger the spinner
    const subdir = path.join(tempDir, 'src');
    mkdirSync(subdir);
    for (let i = 0; i < 510; i++) {
      writeFileSync(path.join(subdir, `component${i}.js`), `export const c = ${i};`, 'utf8');
    }

    await captureOutput(async () => {
      await runInitCommand(tempDir, {}, {
        runProjectScan: mockScanRunner as never,
        loadSkills: mockSkillLoader as never,
        createSpinner: mockSpinnerFactory
      }).catch(() => {});
    });

    expect(mockSpinnerFactory).toHaveBeenCalledOnce();
    expect(start).toHaveBeenCalledOnce();
    expect(stop).toHaveBeenCalledOnce();
  });

  it('does NOT start a spinner for small projects', async () => {
    const mockSpinnerFactory = vi.fn();

    const mockScanRunner = vi.fn().mockResolvedValue({
      summary: { totalFiles: 10 },
      matchedSkills: []
    });
    const mockSkillLoader = vi.fn().mockResolvedValue({ skills: [] });

    await captureOutput(async () => {
      await runInitCommand(tempDir, {}, {
        runProjectScan: mockScanRunner as never,
        loadSkills: mockSkillLoader as never,
        createSpinner: mockSpinnerFactory
      }).catch(() => {});
    });

    expect(mockSpinnerFactory).not.toHaveBeenCalled();
  });
});
