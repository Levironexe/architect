import { mkdtempSync, mkdirSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { discoverFiles } from '../../../src/analyzers/file-walker';

const tempDirectories: string[] = [];
const symlinkPaths: string[] = [];

describe('discoverFiles', () => {
  afterEach(() => {
    while (symlinkPaths.length > 0) {
      const symlinkPath = symlinkPaths.pop();

      if (symlinkPath) {
        unlinkSync(symlinkPath);
      }
    }
  });

  it('discovers supported files and skips hard excluded directories', async () => {
    const fixtureRoot = createTempDirectory();

    writeFileSync(path.join(fixtureRoot, 'index.ts'), 'export const root = true;\n');
    mkdirSync(path.join(fixtureRoot, 'src'), { recursive: true });
    writeFileSync(path.join(fixtureRoot, 'src', 'feature.tsx'), 'export default function Feature() { return null; }\n');
    mkdirSync(path.join(fixtureRoot, 'node_modules'), { recursive: true });
    writeFileSync(path.join(fixtureRoot, 'node_modules', 'ignored.js'), 'console.log("ignored");\n');
    mkdirSync(path.join(fixtureRoot, 'dist'), { recursive: true });
    writeFileSync(path.join(fixtureRoot, 'dist', 'output.js'), 'console.log("ignored");\n');

    const files = await discoverFiles(fixtureRoot);

    expect(files.map((filePath) => path.relative(fixtureRoot, filePath))).toEqual([
      'index.ts',
      path.join('src', 'feature.tsx')
    ]);
  });

  it('respects .gitignore patterns in the target directory', async () => {
    const fixtureRoot = createTempDirectory();

    writeFileSync(path.join(fixtureRoot, '.gitignore'), 'ignored.ts\nsubdir/\n');
    writeFileSync(path.join(fixtureRoot, 'kept.ts'), 'export const kept = true;\n');
    writeFileSync(path.join(fixtureRoot, 'ignored.ts'), 'export const ignored = true;\n');
    mkdirSync(path.join(fixtureRoot, 'subdir'), { recursive: true });
    writeFileSync(path.join(fixtureRoot, 'subdir', 'nested.ts'), 'export const nested = true;\n');

    const files = await discoverFiles(fixtureRoot);

    expect(files.map((filePath) => path.relative(fixtureRoot, filePath))).toEqual(['kept.ts']);
  });

  it('skips symlinks that resolve outside the target directory', async () => {
    const fixtureRoot = createTempDirectory();
    const externalRoot = createTempDirectory();
    const externalFile = path.join(externalRoot, 'outside.ts');

    writeFileSync(path.join(fixtureRoot, 'inside.ts'), 'export const inside = true;\n');
    writeFileSync(externalFile, 'export const outside = true;\n');

    const symlinkPath = path.join(fixtureRoot, 'outside-link.ts');
    symlinkSync(externalFile, symlinkPath);
    symlinkPaths.push(symlinkPath);

    const files = await discoverFiles(fixtureRoot);

    expect(files.map((filePath) => path.relative(fixtureRoot, filePath))).toEqual(['inside.ts']);
  });
});

function createTempDirectory(): string {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'architect-cli-'));
  tempDirectories.push(directory);
  return directory;
}