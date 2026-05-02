import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { analyzeFile } from '../../../src/analyzers/ast-parser';
import { analyzeDuplication } from '../../../src/analyzers/duplication';
import { discoverFiles } from '../../../src/analyzers/file-walker';

describe('analyzeDuplication', () => {
  it('reports duplicate blocks and duplication totals for the duplication fixture', async () => {
    const fixturePath = path.resolve('tests/fixtures/duplicate-blocks-project');
    const discoveredFiles = await discoverFiles(fixturePath);
    const analyses = await Promise.all(discoveredFiles.map((filePath) => analyzeFile(filePath, fixturePath)));

    const duplication = await analyzeDuplication(fixturePath, analyses, []);

    expect(duplication.findings.length).toBeGreaterThan(0);
    expect(duplication.findings[0]?.occurrences).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ relativePath: 'src/a.ts' }),
        expect.objectContaining({ relativePath: 'src/b.ts' })
      ])
    );
    expect(duplication.duplicatedLines).toBeGreaterThan(0);
    expect(duplication.duplicationPercentage).toBeGreaterThan(0);
    expect(duplication.isPartial).toBe(false);
  });
});