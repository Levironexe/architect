import { readFileSync } from 'node:fs';
import path from 'node:path';

import type { Node } from 'web-tree-sitter';

import { DEFAULT_COMPLEXITY_THRESHOLD, DEFAULT_LOC_THRESHOLD, type FileAnalysis, type FunctionInfo, type ClassInfo, type ImportInfo, type ExportInfo } from '../../types/analysis.js';
import type { ScanThresholds } from '../../types/scan-output.js';
import { getParser } from './init.js';
import { nodeLines, countComplexity, findChildByFieldName } from './utils.js';

const PYTHON_BRANCH_TYPES = new Set([
  'if_statement', 'elif_clause', 'for_statement', 'while_statement',
  'conditional_expression', 'except_clause', 'with_statement',
  'boolean_operator', 'list_comprehension', 'set_comprehension',
  'dictionary_comprehension', 'generator_expression',
]);

const PYTHON_STDLIB = new Set([
  'abc', 'aifc', 'argparse', 'array', 'ast', 'asynchat', 'asyncio', 'asyncore',
  'atexit', 'audioop', 'base64', 'bdb', 'binascii', 'binhex', 'bisect',
  'builtins', 'bz2', 'calendar', 'cgi', 'cgitb', 'chunk', 'cmath', 'cmd',
  'code', 'codecs', 'codeop', 'collections', 'colorsys', 'compileall',
  'concurrent', 'configparser', 'contextlib', 'contextvars', 'copy', 'copyreg',
  'cProfile', 'crypt', 'csv', 'ctypes', 'curses', 'dataclasses', 'datetime',
  'dbm', 'decimal', 'difflib', 'dis', 'distutils', 'doctest', 'email',
  'encodings', 'enum', 'errno', 'faulthandler', 'fcntl', 'filecmp', 'fileinput',
  'fnmatch', 'formatter', 'fractions', 'ftplib', 'functools', 'gc', 'getopt',
  'getpass', 'gettext', 'glob', 'grp', 'gzip', 'hashlib', 'heapq', 'hmac',
  'html', 'http', 'idlelib', 'imaplib', 'imghdr', 'imp', 'importlib',
  'inspect', 'io', 'ipaddress', 'itertools', 'json', 'keyword', 'lib2to3',
  'linecache', 'locale', 'logging', 'lzma', 'mailbox', 'mailcap', 'marshal',
  'math', 'mimetypes', 'mmap', 'modulefinder', 'multiprocessing', 'netrc',
  'nis', 'nntplib', 'numbers', 'operator', 'optparse', 'os', 'ossaudiodev',
  'parser', 'pathlib', 'pdb', 'pickle', 'pickletools', 'pipes', 'pkgutil',
  'platform', 'plistlib', 'poplib', 'posix', 'posixpath', 'pprint',
  'profile', 'pstats', 'pty', 'pwd', 'py_compile', 'pyclbr', 'pydoc',
  'queue', 'quopri', 'random', 're', 'readline', 'reprlib', 'resource',
  'rlcompleter', 'runpy', 'sched', 'secrets', 'select', 'selectors',
  'shelve', 'shlex', 'shutil', 'signal', 'site', 'smtpd', 'smtplib',
  'sndhdr', 'socket', 'socketserver', 'sqlite3', 'ssl', 'stat', 'statistics',
  'string', 'stringprep', 'struct', 'subprocess', 'sunau', 'symtable', 'sys',
  'sysconfig', 'syslog', 'tabnanny', 'tarfile', 'telnetlib', 'tempfile',
  'termios', 'test', 'textwrap', 'threading', 'time', 'timeit', 'tkinter',
  'token', 'tokenize', 'trace', 'traceback', 'tracemalloc', 'tty', 'turtle',
  'turtledemo', 'types', 'typing', 'unicodedata', 'unittest', 'urllib',
  'uu', 'uuid', 'venv', 'warnings', 'wave', 'weakref', 'webbrowser',
  'winreg', 'winsound', 'wsgiref', 'xdrlib', 'xml', 'xmlrpc', 'zipapp',
  'zipfile', 'zipimport', 'zlib', '_thread', '__future__',
]);

export async function analyzePythonFile(
  filePath: string,
  rootDirectory: string,
  thresholds: ScanThresholds
): Promise<FileAnalysis> {
  const source = readFileSync(filePath, 'utf-8');
  const parser = await getParser('python');
  const tree = parser.parse(source);

  if (!tree) {
    return createEmptyAnalysis(filePath, rootDirectory, source, thresholds);
  }

  const root = tree.rootNode;
  const lines = source.split('\n');
  const { loc, blankLines, commentLines } = countPythonLines(lines);
  const locThreshold = thresholds.locThreshold ?? DEFAULT_LOC_THRESHOLD;
  const complexityThreshold = thresholds.complexityThreshold ?? DEFAULT_COMPLEXITY_THRESHOLD;

  const functions = extractFunctions(root, complexityThreshold);
  const classes = extractClasses(root);
  const imports = extractImports(root);
  const exports = extractExports(root);

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

function extractFunctions(root: Node, complexityThreshold: number): FunctionInfo[] {
  const functions: FunctionInfo[] = [];

  for (let i = 0; i < root.namedChildCount; i++) {
    const child = root.namedChild(i);
    if (!child) continue;

    if (child.type === 'function_definition') {
      functions.push(buildFunctionInfo(child, complexityThreshold));
    } else if (child.type === 'decorated_definition') {
      const def = findDefinition(child);
      if (def?.type === 'function_definition') {
        functions.push(buildFunctionInfo(def, complexityThreshold));
      }
    }
  }

  return functions;
}

function buildFunctionInfo(node: Node, complexityThreshold: number): FunctionInfo {
  const nameNode = findChildByFieldName(node, 'name');
  const name = nameNode?.text ?? '<anonymous>';
  const params = findChildByFieldName(node, 'parameters');
  const paramCount = params ? countParams(params) : 0;
  const { startLine, endLine, loc } = nodeLines(node);
  const complexity = countComplexity(node, PYTHON_BRANCH_TYPES);

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

function countParams(params: Node): number {
  let count = 0;
  for (let i = 0; i < params.namedChildCount; i++) {
    const child = params.namedChild(i);
    if (!child) continue;
    if (child.type === 'identifier' || child.type === 'typed_parameter' ||
        child.type === 'default_parameter' || child.type === 'typed_default_parameter' ||
        child.type === 'list_splat_pattern' || child.type === 'dictionary_splat_pattern') {
      if (child.text !== 'self' && child.text !== 'cls') count++;
    }
  }
  return count;
}

function extractClasses(root: Node): ClassInfo[] {
  const classes: ClassInfo[] = [];

  for (let i = 0; i < root.namedChildCount; i++) {
    const child = root.namedChild(i);
    if (!child) continue;

    if (child.type === 'class_definition') {
      classes.push(buildClassInfo(child));
    } else if (child.type === 'decorated_definition') {
      const def = findDefinition(child);
      if (def?.type === 'class_definition') {
        classes.push(buildClassInfo(def));
      }
    }
  }

  return classes;
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
      if (child?.type === 'function_definition') methodCount++;
      if (child?.type === 'decorated_definition') {
        const def = findDefinition(child);
        if (def?.type === 'function_definition') methodCount++;
      }
    }
  }

  return { name, startLine, endLine, methodCount };
}

function extractImports(root: Node): ImportInfo[] {
  const imports: ImportInfo[] = [];

  for (let i = 0; i < root.namedChildCount; i++) {
    const child = root.namedChild(i);
    if (!child) continue;

    if (child.type === 'import_statement') {
      const nameNode = findChildByFieldName(child, 'name');
      if (nameNode) {
        const source = nameNode.text;
        imports.push({
          source,
          isRelative: false,
          isBuiltin: isStdlib(source),
          specifiers: [source.split('.').pop() ?? source],
        });
      }
    } else if (child.type === 'import_from_statement') {
      const moduleNode = findChildByFieldName(child, 'module_name');
      const source = moduleNode?.text ?? '';
      const isRelative = moduleNode?.type === 'relative_import';
      const specifiers: string[] = [];

      for (let j = 0; j < child.childCount; j++) {
        const fieldName = child.fieldNameForChild(j);
        const spec = child.child(j);
        if (!spec) continue;

        if (fieldName === 'name') {
          specifiers.push(spec.text);
        } else if (spec.type === 'aliased_import') {
          const name = spec.namedChild(0);
          if (name) specifiers.push(name.text);
        } else if (spec.type === 'wildcard_import') {
          specifiers.push('*');
        }
      }

      imports.push({
        source: source || '.',
        isRelative,
        isBuiltin: !isRelative && isStdlib(source.split('.')[0] ?? ''),
        specifiers,
      });
    }
  }

  return imports;
}

function extractExports(root: Node): ExportInfo[] {
  const exports: ExportInfo[] = [];

  for (let i = 0; i < root.namedChildCount; i++) {
    const child = root.namedChild(i);
    if (!child) continue;

    if (child.type === 'function_definition' || child.type === 'class_definition') {
      const nameNode = findChildByFieldName(child, 'name');
      const name = nameNode?.text;
      if (name && !name.startsWith('_')) {
        exports.push({ name, kind: 'named' });
      }
    } else if (child.type === 'decorated_definition') {
      const def = findDefinition(child);
      if (def?.type === 'function_definition' || def?.type === 'class_definition') {
        const nameNode = findChildByFieldName(def, 'name');
        const name = nameNode?.text;
        if (name && !name.startsWith('_')) {
          exports.push({ name, kind: 'named' });
        }
      }
    }
  }

  return exports;
}

function findDefinition(decoratedNode: Node): Node | null {
  for (let i = 0; i < decoratedNode.namedChildCount; i++) {
    const child = decoratedNode.namedChild(i);
    if (child && (child.type === 'function_definition' || child.type === 'class_definition')) {
      return child;
    }
  }
  return null;
}

function isStdlib(moduleName: string): boolean {
  return PYTHON_STDLIB.has(moduleName);
}

function countPythonLines(lines: string[]): { loc: number; blankLines: number; commentLines: number } {
  let loc = 0;
  let blankLines = 0;
  let commentLines = 0;
  let inDocstring = false;
  let docstringQuote = '';

  for (const line of lines) {
    const trimmed = line.trim();

    if (inDocstring) {
      commentLines++;
      if (trimmed.includes(docstringQuote)) {
        inDocstring = false;
      }
      continue;
    }

    if (trimmed === '') {
      blankLines++;
    } else if (trimmed.startsWith('#')) {
      commentLines++;
    } else if (trimmed.startsWith('"""') || trimmed.startsWith("'''")) {
      docstringQuote = trimmed.slice(0, 3);
      commentLines++;
      if (trimmed.length > 3 && trimmed.endsWith(docstringQuote)) {
        // single-line docstring
      } else {
        inDocstring = true;
      }
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
  const { loc, blankLines, commentLines } = countPythonLines(lines);
  const locThreshold = thresholds.locThreshold ?? DEFAULT_LOC_THRESHOLD;

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
    isOversized: loc > locThreshold,
    hasCriticalComplexity: false,
    parseError: 'Failed to parse file with tree-sitter',
  };
}
