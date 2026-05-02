import { realpathSync, statSync } from 'node:fs';
import path from 'node:path';

export function normalizeToAbsolutePath(targetPath: string, cwd = process.cwd()): string {
  return path.resolve(cwd, targetPath);
}

export function ensureDirectoryPath(targetPath: string): string {
  const absolutePath = normalizeToAbsolutePath(targetPath);
  const stats = statSync(absolutePath);

  if (!stats.isDirectory()) {
    throw new Error(`Target path is not a directory: ${absolutePath}`);
  }

  return absolutePath;
}

export function isPathContained(rootPath: string, candidatePath: string): boolean {
  const normalizedRoot = stripTrailingSeparator(path.resolve(rootPath));
  const normalizedCandidate = stripTrailingSeparator(path.resolve(candidatePath));
  const relativePath = path.relative(normalizedRoot, normalizedCandidate);

  return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
}

export function resolveContainedRealPath(rootPath: string, candidatePath: string): string | null {
  const realRootPath = stripTrailingSeparator(realpathSync(rootPath));
  const realCandidatePath = stripTrailingSeparator(realpathSync(candidatePath));

  return isPathContained(realRootPath, realCandidatePath) ? realCandidatePath : null;
}

export function toRelativePath(rootPath: string, candidatePath: string): string {
  return path.relative(stripTrailingSeparator(rootPath), stripTrailingSeparator(candidatePath)) || '.';
}

function stripTrailingSeparator(targetPath: string): string {
  return targetPath.endsWith(path.sep) ? targetPath.slice(0, -1) : targetPath;
}