import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { discoverFiles, discoverSkippedInputs } from '../../../src/analyzers/file-walker';

describe('file walker edge cases', () => {
  it('discovers supported files and summarizes unsupported inputs', async () => {
    const fixturePath = path.resolve('tests/fixtures/mixed-input-project');
    const files = await discoverFiles(fixturePath);
    const skipped = await discoverSkippedInputs(fixturePath);

    expect(files.map((file) => path.relative(fixturePath, file))).toEqual([path.join('src', 'index.ts')]);
    expect(skipped.map((item) => item.path).sort()).toEqual(['image.png', 'notes.md', 'script.py']);
    expect(skipped.some((item) => item.reason === 'binary')).toBe(true);
    expect(skipped.some((item) => item.reason === 'unsupported_type')).toBe(true);
  });
});
