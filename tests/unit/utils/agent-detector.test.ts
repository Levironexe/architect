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

  it('returns "claude" even when no agent directory is present', () => {
    expect(detectAgent(tempDir)).toBe('claude');
  });

  it('returns "claude" when unrelated agent directories exist', () => {
    mkdirSync(join(tempDir, '.cursor'));
    mkdirSync(join(tempDir, '.github'));
    expect(detectAgent(tempDir)).toBe('claude');
  });
});
