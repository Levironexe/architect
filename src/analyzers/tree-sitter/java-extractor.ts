import { readFileSync } from 'node:fs';
import path from 'node:path';

import type { Node } from 'web-tree-sitter';

import { DEFAULT_COMPLEXITY_THRESHOLD, DEFAULT_LOC_THRESHOLD, type FileAnalysis, type FunctionInfo, type ClassInfo, type ImportInfo, type ExportInfo } from '../../types/analysis.js';
import type { ScanThresholds } from '../../types/scan-output.js';
import { getParser } from './init.js';
import { nodeLines, findChildByFieldName } from './utils.js';

const JAVA_BRANCH_TYPES = new Set([
  'if_statement', 'for_statement', 'enhanced_for_statement',
  'while_statement', 'do_statement', 'conditional_expression',
  'switch_block_statement_group', 'catch_clause',
]);

const JAVA_LOGICAL_OPS = new Set(['&&', '||']);

const BUILTIN_PACKAGES = new Set(['java', 'javax', 'jdk', 'sun', 'com.sun']);

export async function analyzeJavaFile(
  filePath: string,
  rootDirectory: string,
  thresholds: ScanThresholds
): Promise<FileAnalysis> {
  const source = readFileSync(filePath, 'utf-8');
  const parser = await getParser('java');
  const tree = parser.parse(source);

  if (!tree) {
    return createEmptyAnalysis(filePath, rootDirectory, source, thresholds);
  }

  const root = tree.rootNode;
  const lines = source.split('\n');
  const { loc, blankLines, commentLines } = countJavaLines(lines);
  const locThreshold = thresholds.locThreshold ?? DEFAULT_LOC_THRESHOLD;
  const complexityThreshold = thresholds.complexityThreshold ?? DEFAULT_COMPLEXITY_THRESHOLD;

  const functions: FunctionInfo[] = [];
  const classes: ClassInfo[] = [];
  const imports = extractImports(root);
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
      case 'class_declaration':
      case 'interface_declaration':
      case 'enum_declaration':
      case 'record_declaration': {
        const classInfo = buildClassInfo(child);
        classes.push(classInfo);
        if (hasModifier(child, 'public')) {
          const nameNode = findChildByFieldName(child, 'name');
          if (nameNode) exports.push({ name: nameNode.text, kind: 'named' });
        }
        extractMethods(child, functions, complexityThreshold);
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
  const complexity = countJavaComplexity(node);

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

function countJavaComplexity(node: Node): number {
  let complexity = 1;

  function walk(current: Node): void {
    if (JAVA_BRANCH_TYPES.has(current.type)) {
      complexity++;
    }
    if (current.type === 'binary_expression') {
      const op = current.child(1);
      if (op && JAVA_LOGICAL_OPS.has(op.text)) {
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
    if (params.namedChild(i)?.type === 'formal_parameter' ||
        params.namedChild(i)?.type === 'spread_parameter') {
      count++;
    }
  }
  return count;
}

function extractImports(root: Node): ImportInfo[] {
  const imports: ImportInfo[] = [];

  for (let i = 0; i < root.namedChildCount; i++) {
    const child = root.namedChild(i);
    if (child?.type !== 'import_declaration') continue;

    let source = '';
    let hasWildcard = false;

    for (let j = 0; j < child.namedChildCount; j++) {
      const importChild = child.namedChild(j);
      if (importChild?.type === 'scoped_identifier') {
        source = importChild.text;
      } else if (importChild?.type === 'asterisk') {
        hasWildcard = true;
      }
    }

    if (!source) continue;

    const topPackage = source.split('.')[0] ?? '';
    const specifier = hasWildcard ? '*' : source.split('.').pop() ?? source;

    imports.push({
      source: hasWildcard ? source : source.split('.').slice(0, -1).join('.') || source,
      isRelative: false,
      isBuiltin: BUILTIN_PACKAGES.has(topPackage),
      specifiers: [specifier],
    });
  }

  return imports;
}

function hasModifier(node: Node, modifier: string): boolean {
  for (let i = 0; i < node.namedChildCount; i++) {
    const child = node.namedChild(i);
    if (child?.type === 'modifiers') {
      for (let j = 0; j < child.childCount; j++) {
        const mod = child.child(j);
        if (mod?.type === modifier) return true;
      }
    }
  }
  return false;
}

function countJavaLines(lines: string[]): { loc: number; blankLines: number; commentLines: number } {
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
    } else if (trimmed.startsWith('/*') || trimmed.startsWith('/**')) {
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
  const { loc, blankLines, commentLines } = countJavaLines(lines);

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
