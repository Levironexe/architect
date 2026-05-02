import { builtinModules } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { parse } from '@babel/parser';

import {
  DEFAULT_COMPLEXITY_THRESHOLD,
  DEFAULT_LOC_THRESHOLD,
  type ClassInfo,
  type ExportInfo,
  type FileAnalysis,
  type FunctionInfo,
  type ImportInfo
} from '../types/analysis.js';

const builtinModuleSet = new Set(builtinModules);
type AstNode = Record<string, unknown> & { type?: string };

export async function analyzeFile(filePath: string, rootDirectory: string): Promise<FileAnalysis> {
  const source = readFileSync(filePath, 'utf8');
  const parsed = parse(source, {
    sourceType: 'unambiguous',
    errorRecovery: false,
    plugins: [
      'typescript',
      'jsx',
      'classProperties',
      'decorators-legacy',
      'dynamicImport',
      'importMeta',
      'optionalChaining',
      'nullishCoalescingOperator'
    ]
  });

  const functions: FunctionInfo[] = [];
  const classes: ClassInfo[] = [];
  const imports: ImportInfo[] = [];
  const exports: ExportInfo[] = [];
  const lineMetrics = measureLines(source);

  walkNode(parsed as unknown as AstNode, undefined, (node, parent) => {
    switch (node.type) {
      case 'FunctionDeclaration':
        functions.push(createFunctionInfo(node, getIdentifierName(node.id)));
        break;
      case 'FunctionExpression':
      case 'ArrowFunctionExpression':
        functions.push(createFunctionInfo(node, inferFunctionName(node, parent)));
        break;
      case 'ClassDeclaration':
      case 'ClassExpression':
        classes.push(createClassInfo(node, getIdentifierName(node.id)));
        break;
      case 'ImportDeclaration': {
        const sourceValue = getStringValue(node.source);

        if (!sourceValue) {
          break;
        }

        imports.push({
          source: sourceValue,
          isRelative: sourceValue.startsWith('.'),
          isBuiltin: builtinModuleSet.has(sourceValue) || builtinModuleSet.has(sourceValue.replace(/^node:/, '')),
          specifiers: getArray(node.specifiers).map((specifier) => getIdentifierName((specifier as AstNode).local) ?? 'unknown')
        });
        break;
      }
      case 'ExportNamedDeclaration': {
        if (isNode(node.declaration)) {
          exports.push(...extractNamedDeclarationExports(node.declaration));
        }

        for (const specifier of getArray(node.specifiers)) {
          const exported = isNode((specifier as AstNode).exported) ? (specifier as AstNode).exported as AstNode : undefined;
          const exportedName = exported ? (getIdentifierName(exported) ?? getStringValue(exported)) : undefined;

          if (exportedName) {
            exports.push({ name: exportedName, kind: 'named' });
          }
        }
        break;
      }
      case 'ExportDefaultDeclaration':
        exports.push({ name: 'default', kind: 'default' });
        break;
      case 'ExportAllDeclaration':
        exports.push({ name: '*', kind: 'all' });
        break;
      default:
        break;
    }
  });

  const hasCriticalComplexity = functions.some((item) => item.isFlagged);

  return {
    path: filePath,
    relativePath: path.relative(rootDirectory, filePath),
    loc: lineMetrics.loc,
    blankLines: lineMetrics.blankLines,
    commentLines: lineMetrics.commentLines,
    totalLines: lineMetrics.totalLines,
    functions,
    classes,
    imports,
    exports,
    isOversized: lineMetrics.loc > DEFAULT_LOC_THRESHOLD,
    hasCriticalComplexity,
    parseError: null
  };
}

function createFunctionInfo(node: AstNode, name?: string): FunctionInfo {
  const complexity = calculateComplexity(node);
  const location = getLocation(node);
  const params = getArray(node.params);

  return {
    name: name ?? '<anonymous>',
    paramCount: params.length,
    startLine: location?.start.line ?? 0,
    endLine: location?.end.line ?? 0,
    loc: location ? location.end.line - location.start.line + 1 : 0,
    complexity,
    isFlagged: complexity > DEFAULT_COMPLEXITY_THRESHOLD
  };
}

function createClassInfo(node: AstNode, name?: string): ClassInfo {
  const location = getLocation(node);
  const body = isNode(node.body) ? getArray(node.body.body) : [];
  const methodCount = body.filter((member) => isNode(member) && typeof member.type === 'string' && member.type.includes('Method')).length;

  return {
    name: name ?? '<anonymous>',
    startLine: location?.start.line ?? 0,
    endLine: location?.end.line ?? 0,
    methodCount
  };
}

function inferFunctionName(node: AstNode, parent?: AstNode): string | undefined {
  if (parent) {
    if (parent.type === 'VariableDeclarator') {
      return getIdentifierName(parent.id);
    }

    if (parent.type === 'ObjectProperty' || parent.type === 'ObjectMethod' || parent.type === 'ClassMethod') {
      return getIdentifierName(parent.key) ?? getStringValue(parent.key);
    }

    if (parent.type === 'AssignmentExpression' && isNode(parent.left)) {
      return renderMemberName(parent.left);
    }
  }

  return getIdentifierName(node.id);
}

function renderMemberName(node: AstNode): string | undefined {
  if (node.type === 'Identifier') {
    return getIdentifierName(node);
  }

  if (node.type === 'MemberExpression' && isNode(node.property)) {
    return getIdentifierName(node.property) ?? getStringValue(node.property);
  }

  return undefined;
}

function extractNamedDeclarationExports(declaration: AstNode): ExportInfo[] {
  switch (declaration.type) {
    case 'FunctionDeclaration':
    case 'ClassDeclaration':
      return getIdentifierName(declaration.id)
        ? [{ name: getIdentifierName(declaration.id) as string, kind: 'named' }]
        : [];
    case 'VariableDeclaration':
      return getArray(declaration.declarations).flatMap((entry) => {
        if (isNode(entry) && getIdentifierName(entry.id)) {
          return [{ name: getIdentifierName(entry.id) as string, kind: 'named' as const }];
        }

        return [];
      });
    default:
      return [];
  }
}

function calculateComplexity(node: unknown): number {
  return 1 + countDecisionPoints(node, true);
}

function countDecisionPoints(node: unknown, isRoot = false): number {
  if (!node || typeof node !== 'object') {
    return 0;
  }

  const typedNode = node as Record<string, unknown>;
  const nodeType = typeof typedNode.type === 'string' ? typedNode.type : undefined;

  if (!isRoot && isFunctionLike(nodeType)) {
    return 0;
  }

  let count = 0;

  switch (nodeType) {
    case 'IfStatement':
    case 'ForStatement':
    case 'ForInStatement':
    case 'ForOfStatement':
    case 'WhileStatement':
    case 'DoWhileStatement':
    case 'ConditionalExpression':
      count += 1;
      break;
    case 'LogicalExpression':
      if (typedNode.operator === '&&' || typedNode.operator === '||' || typedNode.operator === '??') {
        count += 1;
      }
      break;
    case 'SwitchStatement':
      count += Array.isArray(typedNode.cases) ? typedNode.cases.length : 0;
      break;
    default:
      break;
  }

  for (const value of Object.values(typedNode)) {
    if (!value || typeof value !== 'object') {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        count += countDecisionPoints(item, false);
      }

      continue;
    }

    count += countDecisionPoints(value, false);
  }

  return count;
}

function walkNode(node: unknown, parent: AstNode | undefined, visit: (node: AstNode, parent: AstNode | undefined) => void): void {
  if (!isNode(node)) {
    return;
  }

  visit(node, parent);

  for (const [key, value] of Object.entries(node)) {
    if (key === 'loc' || key === 'start' || key === 'end' || key === 'extra') {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        walkNode(item, node, visit);
      }

      continue;
    }

    walkNode(value, node, visit);
  }
}

function isNode(value: unknown): value is AstNode {
  return typeof value === 'object' && value !== null;
}

function getArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function getIdentifierName(value: unknown): string | undefined {
  if (!isNode(value)) {
    return undefined;
  }

  return typeof value.name === 'string' ? value.name : undefined;
}

function getStringValue(value: unknown): string | undefined {
  if (!isNode(value)) {
    return undefined;
  }

  return typeof value.value === 'string' ? value.value : undefined;
}

function getLocation(value: AstNode): { start: { line: number }; end: { line: number } } | undefined {
  if (!isNode(value.loc)) {
    return undefined;
  }

  const start = isNode(value.loc.start) ? value.loc.start : undefined;
  const end = isNode(value.loc.end) ? value.loc.end : undefined;

  if (start && end && typeof start.line === 'number' && typeof end.line === 'number') {
    return {
      start: { line: start.line },
      end: { line: end.line }
    };
  }

  return undefined;
}

function isFunctionLike(nodeType?: string): boolean {
  return nodeType === 'FunctionDeclaration'
    || nodeType === 'FunctionExpression'
    || nodeType === 'ArrowFunctionExpression'
    || nodeType === 'ClassMethod'
    || nodeType === 'ObjectMethod';
}

function measureLines(source: string): { loc: number; blankLines: number; commentLines: number; totalLines: number } {
  const lines = source.split(/\r?\n/);
  let blankLines = 0;
  let commentLines = 0;
  let loc = 0;
  let insideBlockComment = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (line === '') {
      blankLines += 1;
      continue;
    }

    if (insideBlockComment) {
      commentLines += 1;

      if (line.includes('*/')) {
        insideBlockComment = false;
      }

      continue;
    }

    if (line.startsWith('//')) {
      commentLines += 1;
      continue;
    }

    if (line.startsWith('/*')) {
      commentLines += 1;
      insideBlockComment = !line.includes('*/');
      continue;
    }

    loc += 1;
  }

  return {
    loc,
    blankLines,
    commentLines,
    totalLines: lines.length
  };
}