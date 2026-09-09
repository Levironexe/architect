import { readFileSync } from 'node:fs';
import path from 'node:path';
import { globSync } from 'glob';

/**
 * A package inside the repository that other code imports by name — the
 * `@acme/db` in a monorepo. `deps` is what its own package.json depends on,
 * which is how a rule tells that `@acme/db` is a Prisma package without
 * reading its source.
 */
export interface WorkspacePackage {
  name: string;
  dir: string;
  deps: Set<string>;
}

export function findWorkspacePackages(rootDir: string): Map<string, WorkspacePackage> {
  const packages = new Map<string, WorkspacePackage>();

  const manifests = globSync('**/package.json', {
    cwd: rootDir,
    ignore: ['**/node_modules/**', '**/.next/**', '**/dist/**', '**/build/**'],
    nodir: true
  });

  for (const manifest of manifests) {
    // The root package is not something the root imports from.
    if (manifest === 'package.json') continue;

    let parsed: { name?: unknown; dependencies?: unknown; devDependencies?: unknown };
    try {
      parsed = JSON.parse(readFileSync(path.join(rootDir, manifest), 'utf8')) as typeof parsed;
    } catch {
      continue;
    }

    if (typeof parsed.name !== 'string' || !parsed.name) continue;

    packages.set(parsed.name, {
      name: parsed.name,
      dir: path.dirname(manifest).split(path.sep).join('/'),
      deps: new Set([
        ...Object.keys(asRecord(parsed.dependencies)),
        ...Object.keys(asRecord(parsed.devDependencies))
      ])
    });
  }

  return packages;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}
