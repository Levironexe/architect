import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { analyzeFile } from '../../../src/analyzers/ast-parser';
import { buildDependencyGraphFromImports, findBrokenImports } from '../../../src/analyzers/dependency-graph';
import { discoverFiles } from '../../../src/analyzers/file-walker';

describe('buildDependencyGraphFromImports', () => {
  it('reports hotspots, circular dependencies, and unreferenced files for the dependency fixture', async () => {
    const fixturePath = path.resolve('tests/fixtures/dependency-graph-project');
    const discoveredFiles = await discoverFiles(fixturePath);
    const analyses = await Promise.all(discoveredFiles.map((filePath) => analyzeFile(filePath, fixturePath)));

    const graph = buildDependencyGraphFromImports(analyses, ['.ts', '.tsx', '.js', '.jsx']);

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

describe('findBrokenImports', () => {
  it('ignores stylesheet imports and files that exist on disk but were not analysed', async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), 'architect-broken-'));
    mkdirSync(path.join(rootDir, 'generated'), { recursive: true });
    writeFileSync(path.join(rootDir, 'generated/client.js'), 'export const client = 1;\n');
    writeFileSync(path.join(rootDir, 'styles.css'), 'body {}\n');
    writeFileSync(
      path.join(rootDir, 'entry.ts'),
      [
        "import './styles.css';",
        "import { client } from './generated/client.js';",
        "import { gone } from './missing';",
        'export const value = [client, gone];',
        ''
      ].join('\n')
    );

    // Only entry.ts is "discovered": the generated dir is the kind of thing .gitignore hides.
    const files = [await analyzeFile(path.join(rootDir, 'entry.ts'), rootDir)];

    expect(findBrokenImports(rootDir, files)).toEqual(['entry.ts → ./missing']);
  });
});
