import type { Node } from 'web-tree-sitter';

export function nodeLines(node: Node): { startLine: number; endLine: number; loc: number } {
  const startLine = node.startPosition.row + 1;
  const endLine = node.endPosition.row + 1;
  return { startLine, endLine, loc: endLine - startLine + 1 };
}

export function countComplexity(node: Node, branchTypes: Set<string>): number {
  let complexity = 1;

  function walk(current: Node): void {
    if (branchTypes.has(current.type)) {
      complexity++;
    }
    for (let i = 0; i < current.childCount; i++) {
      const child = current.child(i);
      if (child) walk(child);
    }
  }

  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child) walk(child);
  }

  return complexity;
}

export function findChildByFieldName(node: Node, fieldName: string): Node | null {
  return node.childForFieldName(fieldName);
}

export function countChildrenOfType(node: Node, type: string): number {
  let count = 0;
  for (let i = 0; i < node.childCount; i++) {
    if (node.child(i)?.type === type) count++;
  }
  return count;
}
