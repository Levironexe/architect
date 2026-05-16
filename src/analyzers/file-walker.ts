import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { glob } from 'glob';
import ignore from 'ignore';

import { ALWAYS_EXCLUDED_DIRS, isSupportedExtension, SUPPORTED_EXTENSIONS } from '../types/analysis.js';
import type { SkippedInput } from '../types/scan-output.js';
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

export async function discoverSkippedInputs(targetDirectory: string): Promise<SkippedInput[]> {
  const rootDirectory = ensureDirectoryPath(targetDirectory);
  const candidateFiles = await glob('**/*', {
    absolute: true,
    cwd: rootDirectory,
    nodir: true,
    ignore: ALWAYS_EXCLUDED_DIRS.map((directory: string) => `${directory}/**`)
  });
  const gitignore = loadGitignore(rootDirectory);
  const skipped: SkippedInput[] = [];

  for (const filePath of candidateFiles) {
    const relativePath = path.relative(rootDirectory, filePath);

    if (gitignore?.ignores(relativePath)) {
      skipped.push({
        path: relativePath,
        reason: 'ignored',
        message: 'Skipped because it is ignored by .gitignore.',
        affectsConfidence: false
      });
      continue;
    }

    if (!resolveContainedRealPath(rootDirectory, filePath)) {
      skipped.push({
        path: relativePath,
        reason: 'outside_target',
        message: 'Skipped because it resolves outside the target directory.',
        affectsConfidence: false
      });
      continue;
    }

    if (!isSupportedExtension(filePath)) {
      skipped.push({
        path: relativePath,
        reason: isBinaryLike(filePath) ? 'binary' : 'unsupported_type',
        message: `Skipped unsupported file type ${path.extname(relativePath) || '(none)'}.`,
        affectsConfidence: false
      });
    }
  }

  return skipped.sort((a, b) => a.path.localeCompare(b.path));
}

function isBinaryLike(filePath: string): boolean {
  return ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.woff', '.woff2', '.ttf', '.otf', '.pdf', '.zip'].includes(path.extname(filePath).toLowerCase());
}

function loadGitignore(rootDirectory: string) {
  const gitignorePath = path.join(rootDirectory, '.gitignore');

  if (!existsSync(gitignorePath)) {
    return null;
  }

  return ignore().add(readFileSync(gitignorePath, 'utf8'));
}
