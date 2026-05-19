import type { DeadCodeFinding, DependencyGraphSummary, FileAnalysis } from '../types/analysis.js';

export function analyzeDeadCode(
  files: FileAnalysis[],
  dependencyGraph: DependencyGraphSummary
): DeadCodeFinding[] {
  const findings: DeadCodeFinding[] = [];

  for (const unreferenced of dependencyGraph.unreferencedFiles) {
    const file = files.find((f) => f.relativePath === unreferenced);
    if (!file) continue;
    if (isEntryPoint(file.relativePath)) continue;

    findings.push({
      file: file.relativePath,
      type: 'unreferenced_file',
      confidence: 'high',
    });
  }

  const importedSymbols = collectImportedSymbols(files);

  for (const file of files) {
    if (file.exports.length === 0) continue;

    for (const exp of file.exports) {
      if (exp.kind === 'default') continue;
      if (exp.kind === 'all') continue;

      const key = `${file.relativePath}:${exp.name}`;
      if (!importedSymbols.has(exp.name) && !importedSymbols.has(key)) {
        const isUsedByWildcard = files.some(
          (f) => f !== file && f.imports.some(
            (imp) => imp.specifiers.length === 0 && resolveImportTarget(f.relativePath, imp.source) === file.relativePath
          )
        );

        if (!isUsedByWildcard) {
          findings.push({
            file: file.relativePath,
            export: exp.name,
            type: 'unreferenced_export',
            confidence: 'medium',
          });
        }
      }
    }
  }

  return findings;
}

function collectImportedSymbols(files: FileAnalysis[]): Set<string> {
  const symbols = new Set<string>();

  for (const file of files) {
    for (const imp of file.imports) {
      for (const specifier of imp.specifiers) {
        symbols.add(specifier);
      }
    }
  }

  return symbols;
}

function resolveImportTarget(fromFile: string, importSource: string): string | null {
  if (!importSource.startsWith('.')) return null;
  const dir = fromFile.replace(/\/[^/]+$/, '');
  const parts = [...dir.split('/'), ...importSource.split('/')].filter(Boolean);
  const resolved: string[] = [];
  for (const part of parts) {
    if (part === '..') resolved.pop();
    else if (part !== '.') resolved.push(part);
  }
  return resolved.join('/');
}

function isEntryPoint(relativePath: string): boolean {
  return /(?:^|\/)(?:index|main|app|server)\.[jt]sx?$/.test(relativePath) ||
    /(?:^|\/)page\.[jt]sx?$/.test(relativePath) ||
    /(?:^|\/)layout\.[jt]sx?$/.test(relativePath) ||
    /(?:^|\/)route\.[jt]sx?$/.test(relativePath);
}
