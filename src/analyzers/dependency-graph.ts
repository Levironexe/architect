import path from 'node:path';
import { createRequire } from 'node:module';

import {
  createEmptyDependencyGraphSummary,
  type DependencyGraphSummary,
  type DependencyNode,
  type FileAnalysis,
  type ParseError,
  SUPPORTED_EXTENSIONS
} from '../types/analysis.js';

const require = createRequire(import.meta.url);
const madge = require('madge') as (
  rootDirectory: string,
  config: Record<string, unknown>
) => Promise<{
  obj(): Record<string, string[]>;
  circular(): string[][];
  warnings(): { skipped: string[] };
}>;

export async function analyzeDependencyGraph(
  rootDirectory: string,
  files: FileAnalysis[],
  parseErrors: ParseError[]
): Promise<DependencyGraphSummary> {
  if (files.length === 0) {
    return createEmptyDependencyGraphSummary(parseErrors.length > 0);
  }

  const supportedExtensions = SUPPORTED_EXTENSIONS.map((extension) => extension.slice(1));
  const scannedRelativePaths = new Set(files.map((file) => file.relativePath));
  const graph = await madge(rootDirectory, {
    fileExtensions: supportedExtensions,
    includeNpm: false,
    baseDir: rootDirectory
  });

  const tree = graph.obj() as Record<string, string[]>;
  const importedByMap = new Map<string, string[]>();
  const nodes: DependencyNode[] = files.map((file) => {
    const imports = (tree[file.relativePath] ?? []).filter((entry) => scannedRelativePaths.has(normalizeToRelativePath(entry)));

    for (const dependency of imports) {
      const normalizedDependency = normalizeToRelativePath(dependency);
      const importedBy = importedByMap.get(normalizedDependency) ?? [];
      importedBy.push(file.relativePath);
      importedByMap.set(normalizedDependency, importedBy);
    }

    return {
      path: file.path,
      relativePath: file.relativePath,
      imports: imports.map(normalizeToRelativePath),
      importedBy: []
    };
  });

  for (const node of nodes) {
    node.importedBy = (importedByMap.get(node.relativePath) ?? []).sort();
  }

  const highestDependentCount = nodes.reduce((currentMax, node) => Math.max(currentMax, node.importedBy.length), 0);
  const hotspots = highestDependentCount === 0
    ? []
    : nodes
        .filter((node) => node.importedBy.length === highestDependentCount)
        .map((node) => ({
          relativePath: node.relativePath,
          dependentCount: node.importedBy.length
        }))
        .sort((left, right) => left.relativePath.localeCompare(right.relativePath));

  const circularDependencies = graph
    .circular()
    .map((cycle: string[]) => cycle.map(normalizeToRelativePath))
    .filter((cycle: string[]) => cycle.every((entry: string) => scannedRelativePaths.has(entry)))
    .map((cycle: string[]) => ({ files: [...cycle, cycle[0] as string] }));

  const unreferencedFiles = nodes
    .filter((node) => node.importedBy.length === 0)
    .map((node) => node.relativePath)
    .sort();

  return {
    nodes,
    circularDependencies,
    hotspots,
    unreferencedFiles,
    isPartial: parseErrors.length > 0 || graph.warnings().skipped.length > 0
  };
}

function normalizeToRelativePath(value: string): string {
  return path.normalize(value).split(path.sep).join('/');
}