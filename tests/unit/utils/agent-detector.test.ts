import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { detectAgent } from '../../../src/utils/agent-detector';

describe('detectAgent', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = join(tmpdir(), `architect-agent-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('returns "claude" when .claude/ directory is present', () => {
    mkdirSync(join(tempDir, '.claude'));
    expect(detectAgent(tempDir)).toBe('claude');
  });

  it('returns "cursor" when .cursor/ directory is present', () => {
    mkdirSync(join(tempDir, '.cursor'));
    expect(detectAgent(tempDir)).toBe('cursor');
  });

  it('returns "windsurf" when .windsurf/ directory is present', () => {
    mkdirSync(join(tempDir, '.windsurf'));
    expect(detectAgent(tempDir)).toBe('windsurf');
  });

  it('returns "copilot" when .github/ directory is present', () => {
    mkdirSync(join(tempDir, '.github'));
    expect(detectAgent(tempDir)).toBe('copilot');
  });

  it('returns "generic" when no agent directories are present', () => {
    expect(detectAgent(tempDir)).toBe('generic');
  });

  it('respects priority order when multiple agent directories exist', () => {
    mkdirSync(join(tempDir, '.claude'));
    mkdirSync(join(tempDir, '.cursor'));
    mkdirSync(join(tempDir, '.github'));
    expect(detectAgent(tempDir)).toBe('claude');
  });
});
