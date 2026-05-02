import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { glob } from 'glob';
import ignore from 'ignore';

import { ALWAYS_EXCLUDED_DIRS, SUPPORTED_EXTENSIONS } from '../types/analysis.js';
import { ensureDirectoryPath, resolveContainedRealPath } from '../utils/path.js';

export async function discoverFiles(targetDirectory: string): Promise<string[]> {
  const rootDirectory = ensureDirectoryPath(targetDirectory);
  const candidateFiles = await glob(`**/*.{${SUPPORTED_EXTENSIONS.map((extension: string) => extension.slice(1)).join(',')}}`, {
    absolute: true,
    cwd: rootDirectory,
    nodir: true,
    ignore: ALWAYS_EXCLUDED_DIRS.map((directory: string) => `${directory}/**`)
  });

  const gitignore = loadGitignore(rootDirectory);
  const uniqueFiles = new Set<string>();

  for (const filePath of candidateFiles) {
    const relativePath = path.relative(rootDirectory, filePath);

    if (gitignore?.ignores(relativePath)) {
      continue;
    }

    if (!resolveContainedRealPath(rootDirectory, filePath)) {
      continue;
    }

    uniqueFiles.add(path.resolve(filePath));
  }

  return Array.from(uniqueFiles).sort();
}

function loadGitignore(rootDirectory: string) {
  const gitignorePath = path.join(rootDirectory, '.gitignore');

  if (!existsSync(gitignorePath)) {
    return null;
  }

  return ignore().add(readFileSync(gitignorePath, 'utf8'));
}