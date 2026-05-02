import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { analyzeFile } from '../../../src/analyzers/ast-parser';
import { analyzeDependencyGraph } from '../../../src/analyzers/dependency-graph';
import { discoverFiles } from '../../../src/analyzers/file-walker';

describe('analyzeDependencyGraph', () => {
  it('reports hotspots, circular dependencies, and unreferenced files for the dependency fixture', async () => {
    const fixturePath = path.resolve('tests/fixtures/dependency-graph-project');
    const discoveredFiles = await discoverFiles(fixturePath);
    const analyses = await Promise.all(discoveredFiles.map((filePath) => analyzeFile(filePath, fixturePath)));

    const graph = await analyzeDependencyGraph(fixturePath, analyses, []);

    expect(graph.hotspots).toContainEqual({
      relativePath: 'src/shared/format.ts',
      dependentCount: 3
    });
    expect(graph.circularDependencies).toContainEqual({
      files: ['src/feature/a.ts', 'src/feature/b.ts', 'src/feature/a.ts']
    });
    expect(graph.unreferencedFiles).toContain('src/unused.ts');
    expect(graph.isPartial).toBe(false);
  });
});