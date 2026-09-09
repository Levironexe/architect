import { parse } from '@babel/parser';

/**
 * Facts the rule matchers need, pulled from a real parse rather than a text
 * scan — a regex would fire on `// alert('x')` and on strings that merely
 * mention process.env.
 */
export interface AstFacts {
  /** File-level directive prologue values, e.g. ["use client"]. */
  directives: string[];
  /**
   * `insideCallbackOf` lists every call whose function argument lexically
   * encloses this call, outermost first — `useEffect(() => { fetch() })` gives
   * ['useEffect']. `method` is the literal `method:` of a fetch's options
   * object, uppercased, when there is one.
   */
  calls: Array<{ name: string; line: number; insideCallbackOf: string[]; method?: string }>;
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

  walk(parsed as Node, undefined, (node, parent, callbacks) => {
    const line = node.loc?.start?.line ?? 0;

    if (node.type === 'CallExpression') {
      const name = calleeName(node.callee as Node | undefined);
      if (name) {
        const call: AstFacts['calls'][number] = { name, line, insideCallbackOf: callbacks };
        const method = literalMethod(node);
        if (method) call.method = method;
        facts.calls.push(call);
      }
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

type Visit = (node: Node, parent: Node | undefined, callbacks: string[]) => void;

/**
 * `callbacks` is the stack of call names whose function arguments enclose the
 * current node. It grows only when descending into a function passed as an
 * argument, and is otherwise passed down unchanged — so a fetch inside an
 * inner arrow inside a useEffect body still reads as inside useEffect.
 */
function walk(node: Node | undefined, parent: Node | undefined, visit: Visit, callbacks: string[] = []): void {
  if (!node || typeof node !== 'object') return;

  if (typeof node.type === 'string') visit(node, parent, callbacks);

  const enclosingCall = node.type === 'CallExpression' ? calleeName(node.callee as Node | undefined) : null;

  for (const key of Object.keys(node)) {
    if (key === 'loc' || key === 'leadingComments' || key === 'trailingComments') continue;
    const value = node[key];
    const entries = Array.isArray(value) ? value : value && typeof value === 'object' ? [value] : [];
    for (const entry of entries) {
      const child = entry as Node;
      const isCallbackArg = enclosingCall !== null && key === 'arguments' && isFunctionNode(child);
      walk(child, node, visit, isCallbackArg ? [...callbacks, enclosingCall] : callbacks);
    }
  }
}

function isFunctionNode(node: Node | undefined): boolean {
  return node?.type === 'ArrowFunctionExpression' || node?.type === 'FunctionExpression';
}

/** `fetch(url, { method: 'POST' })` → 'POST'. Non-literal or absent → undefined. */
function literalMethod(call: Node): string | undefined {
  const options = asArray(call.arguments)[1];
  if (options?.type !== 'ObjectExpression') return undefined;
  for (const prop of asArray(options.properties)) {
    if (prop.type !== 'ObjectProperty') continue;
    const key = identifierName(prop.key as Node | undefined);
    if (key !== 'method') continue;
    const value = prop.value as Node | undefined;
    return value?.type === 'StringLiteral' && typeof value.value === 'string'
      ? value.value.toUpperCase()
      : undefined;
  }
  return undefined;
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
