import type { RenderedSkillFile } from '../types/generation.js';
import type { WriterTarget } from './writer-types.js';

export function buildClaudeWriterTargets(files: RenderedSkillFile[]): WriterTarget[] {
  return files.map((file) => ({
    name: file.name,
    relativePath: `.claude/skills/${file.name}/SKILL.md`,
    content: file.content,
    mode: 'replace'
  }));
}