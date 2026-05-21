import { readFileSync } from 'node:fs';
import path from 'node:path';

import type { CommentSyntax } from '../languages/registry.js';
import type { FileAnalysis } from '../types/analysis.js';
import { measureLines } from './line-counter.js';

export function analyzeLiteFile(
  filePath: string,
  rootDirectory: string,
  locThreshold: number,
  commentSyntax: CommentSyntax
): FileAnalysis {
  const source = readFileSync(filePath, 'utf-8');
  const metrics = measureLines(source, commentSyntax);
  const relativePath = path.relative(rootDirectory, filePath).split(path.sep).join('/');

  return {
    path: filePath,
    relativePath,
    loc: metrics.loc,
    blankLines: metrics.blankLines,
    commentLines: metrics.commentLines,
    totalLines: metrics.totalLines,
    functions: [],
    classes: [],
    imports: [],
    exports: [],
    isOversized: metrics.loc > locThreshold,
    hasCriticalComplexity: false,
    parseError: null
  };
}
