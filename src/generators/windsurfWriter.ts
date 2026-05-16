import type { RenderedSkillFile } from '../types/generation.js';
import type { WriterTarget } from './writer-types.js';

export function buildWindsurfWriterTargets(files: RenderedSkillFile[]): WriterTarget[] {
  return [
    {
      name: 'architect',
      relativePath: '.windsurf/rules/architect.md',
      content: buildCombinedContent(files),
      mode: 'replace'
    }
  ];
}

function buildCombinedContent(files: RenderedSkillFile[]): string {
  return files.map((file) => `## ${file.name}\n\n${file.content.trim()}`).join('\n\n');
}