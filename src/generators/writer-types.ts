import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

import type { RenderedSkillFile } from '../types/generation.js';

export type WriterMode = 'replace' | 'append';

export interface WriterTarget {
  name: string;
  relativePath: string;
  content: string;
  mode: WriterMode;
}

export type IntegrationWriter = (files: RenderedSkillFile[]) => WriterTarget[];

export function findExistingWriterTargets(targetDir: string, targets: WriterTarget[]): string[] {
  return targets
    .map((target) => target.relativePath)
    .filter((relativePath) => existsSync(path.join(targetDir, relativePath)));
}

export async function writeWriterTargets(targetDir: string, targets: WriterTarget[]): Promise<string[]> {
  const written: string[] = [];

  for (const target of targets) {
    const destinationPath = path.join(targetDir, target.relativePath);
    await fs.mkdir(path.dirname(destinationPath), { recursive: true });

    if (target.mode === 'append') {
      const existing = await readExisting(destinationPath);
      const content = existing.trim().length > 0 ? `${existing.trimEnd()}\n\n${target.content}` : target.content;
      await fs.writeFile(destinationPath, content, 'utf8');
    } else {
      await fs.writeFile(destinationPath, target.content, 'utf8');
    }

    written.push(target.relativePath);
  }

  return written;
}

async function readExisting(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      return '';
    }

    throw error;
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}