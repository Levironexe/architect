import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { analyzeFile } from '../../../src/analyzers/ast-parser';

describe('analyzeFile', () => {
  it('extracts functions and critical-complexity flags from the messy fixture', async () => {
    const filePath = path.resolve('tests/fixtures/messy-express/src/services/health.service.ts');
    const analysis = await analyzeFile(filePath, path.resolve('tests/fixtures/messy-express'));

    expect(analysis.relativePath).toBe('src/services/health.service.ts');
    expect(analysis.loc).toBeGreaterThan(0);
    expect(analysis.hasCriticalComplexity).toBe(true);

    const functionNames = analysis.functions.map((item) => item.name);
    expect(functionNames).toContain('calculateLegacyHealth');
    expect(analysis.functions.find((item) => item.name === 'calculateLegacyHealth')?.complexity).toBeGreaterThan(15);
  });

  it('extracts exported functions from the clean fixture', async () => {
    const filePath = path.resolve('tests/fixtures/clean-project/index.ts');
    const analysis = await analyzeFile(filePath, path.dirname(filePath));

    expect(analysis.loc).toBeGreaterThan(0);
    expect(analysis.functions).toHaveLength(2);
    expect(analysis.classes).toHaveLength(0);
    expect(analysis.hasCriticalComplexity).toBe(false);
  });
});