/**
 * Minimal glob matcher for repo-relative paths.
 *
 * Supports `*` (one segment), `**` (any number of segments) and `?`.
 * Patterns are anchored at a segment boundary rather than at the repo root,
 * so `app/**\/page.tsx` matches both `app/users/page.tsx` and
 * `src/app/users/page.tsx` — projects put the App Router in either place.
 */
export function matchesGlob(relativePath: string, pattern: string): boolean {
  return globToRegExp(pattern).test(normalize(relativePath));
}

export function matchesAnyGlob(relativePath: string, patterns: string[] | undefined): boolean {
  if (!patterns || patterns.length === 0) return true;
  return patterns.some((pattern) => matchesGlob(relativePath, pattern));
}

function normalize(value: string): string {
  return value.replace(/\\/g, '/').replace(/^\.\//, '');
}

const cache = new Map<string, RegExp>();

function globToRegExp(pattern: string): RegExp {
  const cached = cache.get(pattern);
  if (cached) return cached;

  const normalized = normalize(pattern);
  let source = '';

  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index]!;

    if (char === '*') {
      const isDoubleStar = normalized[index + 1] === '*';
      if (isDoubleStar) {
        const skipsSlash = normalized[index + 2] === '/';
        source += skipsSlash ? '(?:[^/]+/)*' : '.*';
        index += skipsSlash ? 2 : 1;
      } else {
        source += '[^/]*';
      }
      continue;
    }

    if (char === '?') {
      source += '[^/]';
      continue;
    }

    source += char.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }

  // Anchor at a segment boundary so a pattern can match a nested source root.
  const regexp = new RegExp(`(^|/)${source}$`);
  cache.set(pattern, regexp);
  return regexp;
}
