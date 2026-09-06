import { parse } from '@babel/parser';

/**
 * Facts the rule matchers need, pulled from a real parse rather than a text
 * scan — a regex would fire on `// alert('x')` and on strings that merely
 * mention process.env.
 */
export interface AstFacts {
  /** File-level directive prologue values, e.g. ["use client"]. */
  directives: string[];
  calls: Array<{ name: string; line: number }>;
  members: Array<{ text: string; object: string; property: string; line: number }>;
  throws: Array<{ line: number }>;
}

const EMPTY: AstFacts = { directives: [], calls: [], members: [], throws: [] };

export type AstFactsCache = Map<string, AstFacts>;

export function createAstFactsCache(): AstFactsCache {
  return new Map();
}

/**
 * `key` must be unique per file across every project checked in one process —
 * use the absolute path. Keying on the repo-relative path collides between
 * two roots that share a filename.
 */
export function extractAstFacts(key: string, source: string, cache: AstFactsCache): AstFacts {
  const cached = cache.get(key);
  if (cached) return cached;

  let parsed: unknown;
  try {
    parsed = parse(source, {
      sourceType: 'unambiguous',
      allowReturnOutsideFunction: true,
      plugins: ['typescript', 'jsx', 'decorators-legacy']
    });
  } catch {
    cache.set(key, EMPTY);
    return EMPTY;
  }

  const facts: AstFacts = { directives: [], calls: [], members: [], throws: [] };
  const program = (parsed as Node).program as Node | undefined;

  for (const directive of asArray(program?.directives)) {
    const value = (directive.value as Node | undefined)?.value;
    if (typeof value === 'string') facts.directives.push(value);
  }

  walk(parsed as Node, undefined, (node, parent) => {
    const line = node.loc?.start?.line ?? 0;

    if (node.type === 'CallExpression') {
      const name = calleeName(node.callee as Node | undefined);
      if (name) facts.calls.push({ name, line });
      return;
    }

    if (node.type === 'MemberExpression') {
      // Only the outermost node of a chain: for process.env.DATABASE_URL we
      // want the whole path, not the inner process.env.
      if (parent?.type === 'MemberExpression' && parent.object === node) return;

      const root = rootIdentifier(node);
      const firstProperty = firstPropertyAfterRoot(node);
      if (root && firstProperty) {
        facts.members.push({ text: memberText(node), object: root, property: firstProperty, line });
      }
      return;
    }

    if (node.type === 'ThrowStatement') {
      facts.throws.push({ line });
    }
  });

  cache.set(key, facts);
  return facts;
}

interface Node {
  type?: string;
  loc?: { start?: { line: number } };
  [key: string]: unknown;
}

/** Flattens `a.b.c` to its dotted text so exclusions can match a prefix. */
function memberText(node: Node): string {
  const object = node.object as Node | undefined;
  const property = identifierName(node.property as Node | undefined) ?? '';
  const base = object?.type === 'MemberExpression'
    ? memberText(object)
    : identifierName(object) ?? '';
  return base ? `${base}.${property}` : property;
}

function calleeName(callee: Node | undefined): string | null {
  if (!callee) return null;
  if (callee.type === 'Identifier') return identifierName(callee);
  if (callee.type === 'MemberExpression') return identifierName(callee.property as Node | undefined);
  return null;
}

function identifierName(node: Node | undefined): string | null {
  if (!node) return null;
  if (node.type === 'Identifier' && typeof node.name === 'string') return node.name;
  if (node.type === 'StringLiteral' && typeof node.value === 'string') return node.value;
  return null;
}

function asArray(value: unknown): Node[] {
  return Array.isArray(value) ? (value as Node[]) : [];
}

function walk(node: Node | undefined, parent: Node | undefined, visit: (node: Node, parent: Node | undefined) => void): void {
  if (!node || typeof node !== 'object') return;

  if (typeof node.type === 'string') visit(node, parent);

  for (const key of Object.keys(node)) {
    if (key === 'loc' || key === 'leadingComments' || key === 'trailingComments') continue;
    const value = node[key];
    if (Array.isArray(value)) {
      for (const entry of value) walk(entry as Node, node, visit);
    } else if (value && typeof value === 'object') {
      walk(value as Node, node, visit);
    }
  }
}

/** The identifier a member chain roots at: `process` in process.env.X. */
function rootIdentifier(node: Node): string | null {
  let current: Node | undefined = node;
  while (current?.type === 'MemberExpression') {
    current = current.object as Node | undefined;
  }
  return identifierName(current);
}

/** The first property after the root: `env` in process.env.X. */
function firstPropertyAfterRoot(node: Node): string | null {
  let current: Node | undefined = node;
  let deepest: Node | undefined;
  while (current?.type === 'MemberExpression') {
    deepest = current;
    current = current.object as Node | undefined;
  }
  return deepest ? identifierName(deepest.property as Node | undefined) : null;
}
