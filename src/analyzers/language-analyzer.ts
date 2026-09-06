import type { FileAnalysis } from '../types/analysis.js';
import type { ScanThresholds } from '../types/scan-output.js';
import { analyzeFile } from './ast-parser.js';

export async function analyzeFileByLanguage(
  filePath: string,
  rootDirectory: string,
  languageId: string,
  thresholds: ScanThresholds
): Promise<FileAnalysis> {
  if (languageId !== 'javascript') {
    throw new Error(`No analyzer for language: ${languageId}`);
  }
  return analyzeFile(filePath, rootDirectory, thresholds);
}
