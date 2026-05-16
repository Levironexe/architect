import type { RenderedSkillFile } from '../types/generation.js';
import type { WriterTarget } from './writer-types.js';

export function buildCopilotWriterTargets(files: RenderedSkillFile[]): WriterTarget[] {
  return [
    {
      name: 'copilot-instructions',
      relativePath: '.github/copilot-instructions.md',
      content: files.map((file) => `## ${file.name}\n\n${file.content.trim()}`).join('\n\n'),
      mode: 'append'
    }
  ];
}