import fs from 'node:fs/promises';
import path from 'node:path';
import type { LanguageConfig } from './registry.js';

export const PYTHON_CONFIG: LanguageConfig = {
  id: 'python',
  name: 'Python',
  extensions: ['.py'],
  configFiles: ['pyproject.toml', 'requirements.txt', 'setup.py', 'Pipfile'],
  supportsScanning: 'lite',
  commentSyntax: { line: ['#'], blockStart: '"""', blockEnd: '"""' },

  async readDependencies(rootDir: string): Promise<string[]> {
    const deps = await readPyprojectDeps(rootDir);
    if (deps.length > 0) return deps;

    const reqDeps = await readRequirementsTxt(rootDir);
    if (reqDeps.length > 0) return reqDeps;

    const pipfileDeps = await readPipfile(rootDir);
    if (pipfileDeps.length > 0) return pipfileDeps;

    return readSetupPy(rootDir);
  }
};

async function readPyprojectDeps(rootDir: string): Promise<string[]> {
  try {
    const contents = await fs.readFile(path.join(rootDir, 'pyproject.toml'), 'utf8');
    const deps: string[] = [];

    const projectDepsMatch = contents.match(/\[project\]\s[\s\S]*?dependencies\s*=\s*\[([\s\S]*?)\]/);
    if (projectDepsMatch?.[1]) {
      deps.push(...extractQuotedPackages(projectDepsMatch[1]));
    }

    const poetryDepsMatch = contents.match(/\[tool\.poetry\.dependencies\]\s*([\s\S]*?)(?:\n\[|\n$)/);
    if (poetryDepsMatch?.[1]) {
      const lines = poetryDepsMatch[1].split('\n');
      for (const line of lines) {
        const match = line.match(/^(\S+)\s*=/);
        if (match?.[1] && match[1] !== 'python') {
          deps.push(normalizePackageName(match[1]));
        }
      }
    }

    const optionalMatch = contents.matchAll(/\[project\.optional-dependencies\.\w+\]\s*\n([\s\S]*?)(?:\n\[|\n$)/g);
    for (const m of optionalMatch) {
      if (m[1]) deps.push(...extractQuotedPackages(m[1]));
    }

    return [...new Set(deps)];
  } catch {
    return [];
  }
}

async function readRequirementsTxt(rootDir: string): Promise<string[]> {
  try {
    const contents = await fs.readFile(path.join(rootDir, 'requirements.txt'), 'utf8');
    return parseRequirementsFormat(contents);
  } catch {
    return [];
  }
}

async function readPipfile(rootDir: string): Promise<string[]> {
  try {
    const contents = await fs.readFile(path.join(rootDir, 'Pipfile'), 'utf8');
    const deps: string[] = [];

    const packagesMatch = contents.match(/\[packages\]\s*([\s\S]*?)(?:\n\[|\n$)/);
    if (packagesMatch?.[1]) {
      const lines = packagesMatch[1].split('\n');
      for (const line of lines) {
        const match = line.match(/^(\S+)\s*=/);
        if (match?.[1]) {
          deps.push(normalizePackageName(match[1]));
        }
      }
    }

    return deps;
  } catch {
    return [];
  }
}

async function readSetupPy(rootDir: string): Promise<string[]> {
  try {
    const contents = await fs.readFile(path.join(rootDir, 'setup.py'), 'utf8');
    const match = contents.match(/install_requires\s*=\s*\[([\s\S]*?)\]/);
    if (!match?.[1]) return [];
    return extractQuotedPackages(match[1]);
  } catch {
    return [];
  }
}

function parseRequirementsFormat(contents: string): string[] {
  const deps: string[] = [];
  for (const rawLine of contents.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith('-')) continue;
    const name = line.split(/[>=<!~;\[]/)[0]?.trim();
    if (name) deps.push(normalizePackageName(name));
  }
  return deps;
}

function extractQuotedPackages(block: string): string[] {
  const deps: string[] = [];
  const matches = block.matchAll(/["']([^"']+)["']/g);
  for (const m of matches) {
    const name = m[1]?.split(/[>=<!~;\[]/)[0]?.trim();
    if (name) deps.push(normalizePackageName(name));
  }
  return deps;
}

function normalizePackageName(name: string): string {
  return name.toLowerCase().replace(/[-_.]+/g, '-');
}
