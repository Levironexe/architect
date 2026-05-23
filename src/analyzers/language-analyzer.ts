import type { FileAnalysis } from '../types/analysis.js';
import type { ScanThresholds } from '../types/scan-output.js';
import { analyzeFile } from './ast-parser.js';
import { analyzePythonFile } from './tree-sitter/python-extractor.js';
import { analyzeCSharpFile } from './tree-sitter/csharp-extractor.js';
import { analyzeJavaFile } from './tree-sitter/java-extractor.js';

export async function analyzeFileByLanguage(
  filePath: string,
  rootDirectory: string,
  languageId: string,
  thresholds: ScanThresholds
): Promise<FileAnalysis> {
  switch (languageId) {
    case 'javascript':
      return analyzeFile(filePath, rootDirectory, thresholds);
    case 'python':
      return analyzePythonFile(filePath, rootDirectory, thresholds);
    case 'csharp':
      return analyzeCSharpFile(filePath, rootDirectory, thresholds);
    case 'java':
      return analyzeJavaFile(filePath, rootDirectory, thresholds);
    default:
      throw new Error(`No full analyzer for language: ${languageId}`);
  }
}
