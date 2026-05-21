import type { CommentSyntax } from '../languages/registry.js';

export interface LineMetrics {
  loc: number;
  blankLines: number;
  commentLines: number;
  totalLines: number;
}

export function measureLines(source: string, syntax: CommentSyntax): LineMetrics {
  const lines = source.split(/\r?\n/);
  let blankLines = 0;
  let commentLines = 0;
  let loc = 0;
  let insideBlockComment = false;
  let blockEnd = '';

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (line === '') {
      blankLines += 1;
      continue;
    }

    if (insideBlockComment) {
      commentLines += 1;
      if (line.includes(blockEnd)) {
        insideBlockComment = false;
      }
      continue;
    }

    if (syntax.line.some((prefix) => line.startsWith(prefix))) {
      commentLines += 1;
      continue;
    }

    if (syntax.blockStart && syntax.blockEnd && line.startsWith(syntax.blockStart)) {
      commentLines += 1;
      if (!line.slice(syntax.blockStart.length).includes(syntax.blockEnd)) {
        insideBlockComment = true;
        blockEnd = syntax.blockEnd;
      }
      continue;
    }

    loc += 1;
  }

  return { loc, blankLines, commentLines, totalLines: lines.length };
}
