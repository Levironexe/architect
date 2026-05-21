import path from 'node:path';
import { createRequire } from 'node:module';

import {
  createEmptyDuplicationSummary,
  type DuplicationFinding,
  type DuplicationSummary,
  type FileAnalysis,
  type ParseError
} from '../types/analysis.js';

const require = createRequire(import.meta.url);
const { detectClones } = require('jscpd') as {
  detectClones: (options: Record<string, unknown>) => Promise<Array<{
    duplicationA: {
      sourceId: string;
      start: { line: number };
      end: { line: number };
    };
    duplicationB: {
      sourceId: string;
      start: { line: number };
      end: { line: number };
    };
  }>>;
};

export async function analyzeDuplication(
  rootDirectory: string,
  files: FileAnalysis[],
  parseErrors: ParseError[]
): Promise<DuplicationSummary> {
  if (files.length === 0) {
    return createEmptyDuplicationSummary(parseErrors.length > 0);
  }

  const scannedRelativePaths = new Set(files.map((file) => file.relativePath));
  const clones = await detectClones({
    path: [rootDirectory],
    minTokens: 50,
    silent: true,
    absolute: true,
    reporters: [],
    ignore: [
      '**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**',
      '**/__pycache__/**', '**/.venv/**', '**/venv/**', '**/bin/**',
      '**/obj/**', '**/target/**', '**/.gradle/**'
    ]
  });

  const findings: DuplicationFinding[] = clones
    .map((clone) => {
      const occurrenceA = {
        relativePath: toRelativePath(rootDirectory, clone.duplicationA.sourceId),
        startLine: clone.duplicationA.start.line,
        endLine: clone.duplicationA.end.line
      };
      const occurrenceB = {
        relativePath: toRelativePath(rootDirectory, clone.duplicationB.sourceId),
        startLine: clone.duplicationB.start.line,
        endLine: clone.duplicationB.end.line
      };

      return {
        occurrences: [occurrenceA, occurrenceB],
        duplicatedLines: Math.max(occurrenceA.endLine - occurrenceA.startLine + 1, occurrenceB.endLine - occurrenceB.startLine + 1),
        similarity: null
      };
    })
    .filter((finding) => finding.occurrences.every((occurrence) => scannedRelativePaths.has(occurrence.relativePath)))
    .sort((left, right) => {
      const leftKey = left.occurrences.map((occurrence) => occurrence.relativePath).join(':');
      const rightKey = right.occurrences.map((occurrence) => occurrence.relativePath).join(':');
      return leftKey.localeCompare(rightKey);
    });

  const duplicatedLines = findings.reduce((total, finding) => total + finding.duplicatedLines, 0);
  const totalLoc = files.reduce((total, file) => total + file.loc, 0);
  const duplicationPercentage = totalLoc === 0 ? 0 : Number(((duplicatedLines / totalLoc) * 100).toFixed(1));

  return {
    findings,
    duplicatedLines,
    duplicationPercentage,
    isPartial: parseErrors.length > 0
  };
}

function toRelativePath(rootDirectory: string, filePath: string): string {
  return path.relative(rootDirectory, filePath).split(path.sep).join('/');
}