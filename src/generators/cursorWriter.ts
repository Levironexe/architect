import type { RenderedSkillFile } from '../types/generation.js';
import type { WriterTarget } from './writer-types.js';

export function buildCursorWriterTargets(files: RenderedSkillFile[]): WriterTarget[] {
  return [
    {
      name: 'architect',
      relativePath: '.cursor/rules/architect.mdc',
      content: buildCombinedContent(files),
      mode: 'replace'
    }
  ];
}

function buildCombinedContent(files: RenderedSkillFile[]): string {
  return files.map((file) => `## ${file.name}\n\n${file.content.trim()}`).join('\n\n');
}