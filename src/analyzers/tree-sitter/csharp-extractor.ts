import { readFileSync } from 'node:fs';
import path from 'node:path';

import type { Node } from 'web-tree-sitter';

import { DEFAULT_COMPLEXITY_THRESHOLD, DEFAULT_LOC_THRESHOLD, type FileAnalysis, type FunctionInfo, type ClassInfo, type ImportInfo, type ExportInfo } from '../../types/analysis.js';
import type { ScanThresholds } from '../../types/scan-output.js';
import { getParser } from './init.js';
import { nodeLines, countComplexity, findChildByFieldName } from './utils.js';

const CSHARP_BRANCH_TYPES = new Set([
  'if_statement', 'else_clause', 'for_statement', 'foreach_statement',
  'while_statement', 'do_statement', 'conditional_expression',
  'switch_expression_arm', 'case_switch_label', 'catch_clause',
  'conditional_access_expression',
]);

const CSHARP_LOGICAL_OPS = new Set(['&&', '||', '??']);

const BUILTIN_NAMESPACES = new Set([
  'System', 'Microsoft', 'Windows',
]);

export async function analyzeCSharpFile(
  filePath: string,
  rootDirectory: string,
  thresholds: ScanThresholds
): Promise<FileAnalysis> {
  const source = readFileSync(filePath, 'utf-8');
  const parser = await getParser('csharp');
  const tree = parser.parse(source);

  if (!tree) {
    return createEmptyAnalysis(filePath, rootDirectory, source, thresholds);
  }

  const root = tree.rootNode;
  const lines = source.split('\n');
  const { loc, blankLines, commentLines } = countCSharpLines(lines);
  const locThreshold = thresholds.locThreshold ?? DEFAULT_LOC_THRESHOLD;
  const complexityThreshold = thresholds.complexityThreshold ?? DEFAULT_COMPLEXITY_THRESHOLD;

  const functions: FunctionInfo[] = [];
  const classes: ClassInfo[] = [];
  const imports = extractUsings(root);
  const exports: ExportInfo[] = [];

  collectDeclarations(root, functions, classes, exports, complexityThreshold);

  tree.delete();

  return {
    path: filePath,
    relativePath: path.relative(rootDirectory, filePath),
    loc,
    blankLines,
    commentLines,
    totalLines: lines.length,
    functions,
    classes,
    imports,
    exports,
    isOversized: loc > locThreshold,
    hasCriticalComplexity: functions.some((f) => f.isFlagged),
    parseError: null,
  };
}

function collectDeclarations(
  node: Node,
  functions: FunctionInfo[],
  classes: ClassInfo[],
  exports: ExportInfo[],
  complexityThreshold: number
): void {
  for (let i = 0; i < node.namedChildCount; i++) {
    const child = node.namedChild(i);
    if (!child) continue;

    switch (child.type) {
      case 'namespace_declaration':
      case 'file_scoped_namespace_declaration': {
        const body = findChildByFieldName(child, 'body');
        if (body) collectDeclarations(body, functions, classes, exports, complexityThreshold);
        else collectDeclarations(child, functions, classes, exports, complexityThreshold);
        break;
      }

      case 'class_declaration':
      case 'struct_declaration':
      case 'record_declaration':
      case 'interface_declaration': {
        const classInfo = buildClassInfo(child);
        classes.push(classInfo);
        if (hasModifier(child, 'public')) {
          const nameNode = findChildByFieldName(child, 'name');
          if (nameNode) exports.push({ name: nameNode.text, kind: 'named' });
        }
        extractMethods(child, functions, complexityThreshold);
        break;
      }

      case 'enum_declaration': {
        if (hasModifier(child, 'public')) {
          const nameNode = findChildByFieldName(child, 'name');
          if (nameNode) exports.push({ name: nameNode.text, kind: 'named' });
        }
        break;
      }
    }
  }
}

function buildClassInfo(node: Node): ClassInfo {
  const nameNode = findChildByFieldName(node, 'name');
  const name = nameNode?.text ?? '<anonymous>';
  const { startLine, endLine } = nodeLines(node);
  const body = findChildByFieldName(node, 'body');
  let methodCount = 0;

  if (body) {
    for (let i = 0; i < body.namedChildCount; i++) {
      const child = body.namedChild(i);
      if (child?.type === 'method_declaration' || child?.type === 'constructor_declaration') {
        methodCount++;
      }
    }
  }

  return { name, startLine, endLine, methodCount };
}

function extractMethods(classNode: Node, functions: FunctionInfo[], complexityThreshold: number): void {
  const body = findChildByFieldName(classNode, 'body');
  if (!body) return;

  for (let i = 0; i < body.namedChildCount; i++) {
    const child = body.namedChild(i);
    if (!child) continue;

    if (child.type === 'method_declaration' || child.type === 'constructor_declaration') {
      functions.push(buildFunctionInfo(child, complexityThreshold));
    }
  }
}

function buildFunctionInfo(node: Node, complexityThreshold: number): FunctionInfo {
  const nameNode = findChildByFieldName(node, 'name');
  const name = nameNode?.text ?? '<anonymous>';
  const params = findChildByFieldName(node, 'parameters');
  const paramCount = params ? countParams(params) : 0;
  const { startLine, endLine, loc } = nodeLines(node);
  const complexity = countCSharpComplexity(node);

  return {
    name,
    paramCount,
    startLine,
    endLine,
    loc,
    complexity,
    isFlagged: complexity > complexityThreshold,
  };
}

function countCSharpComplexity(node: Node): number {
  let complexity = 1;

  function walk(current: Node): void {
    if (CSHARP_BRANCH_TYPES.has(current.type)) {
      complexity++;
    }
    if (current.type === 'binary_expression') {
      const op = current.child(1);
      if (op && CSHARP_LOGICAL_OPS.has(op.text)) {
        complexity++;
      }
    }
    for (let i = 0; i < current.childCount; i++) {
      const child = current.child(i);
      if (child) walk(child);
    }
  }

  const body = findChildByFieldName(node, 'body');
  if (body) walk(body);
  return complexity;
}

function countParams(params: Node): number {
  let count = 0;
  for (let i = 0; i < params.namedChildCount; i++) {
    if (params.namedChild(i)?.type === 'parameter') count++;
  }
  return count;
}

function extractUsings(root: Node): ImportInfo[] {
  const imports: ImportInfo[] = [];

  for (let i = 0; i < root.namedChildCount; i++) {
    const child = root.namedChild(i);
    if (child?.type !== 'using_directive') continue;

    let source = '';
    for (let j = 0; j < child.namedChildCount; j++) {
      const nameChild = child.namedChild(j);
      if (nameChild?.type === 'qualified_name' || nameChild?.type === 'identifier') {
        source = nameChild.text;
        break;
      }
    }

    if (!source) continue;

    const topNamespace = source.split('.')[0] ?? '';
    imports.push({
      source,
      isRelative: false,
      isBuiltin: BUILTIN_NAMESPACES.has(topNamespace),
      specifiers: [source.split('.').pop() ?? source],
    });
  }

  return imports;
}

function hasModifier(node: Node, modifier: string): boolean {
  for (let i = 0; i < node.namedChildCount; i++) {
    const child = node.namedChild(i);
    if (child?.type === 'modifier' && child.text === modifier) return true;
  }
  return false;
}

function countCSharpLines(lines: string[]): { loc: number; blankLines: number; commentLines: number } {
  let loc = 0;
  let blankLines = 0;
  let commentLines = 0;
  let inBlock = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (inBlock) {
      commentLines++;
      if (trimmed.includes('*/')) inBlock = false;
      continue;
    }

    if (trimmed === '') {
      blankLines++;
    } else if (trimmed.startsWith('//')) {
      commentLines++;
    } else if (trimmed.startsWith('/*')) {
      commentLines++;
      if (!trimmed.includes('*/')) inBlock = true;
    } else {
      loc++;
    }
  }

  return { loc, blankLines, commentLines };
}

function createEmptyAnalysis(
  filePath: string,
  rootDirectory: string,
  source: string,
  thresholds: ScanThresholds
): FileAnalysis {
  const lines = source.split('\n');
  const { loc, blankLines, commentLines } = countCSharpLines(lines);

  return {
    path: filePath,
    relativePath: path.relative(rootDirectory, filePath),
    loc,
    blankLines,
    commentLines,
    totalLines: lines.length,
    functions: [],
    classes: [],
    imports: [],
    exports: [],
    isOversized: loc > (thresholds.locThreshold ?? DEFAULT_LOC_THRESHOLD),
    hasCriticalComplexity: false,
    parseError: 'Failed to parse file with tree-sitter',
  };
}
