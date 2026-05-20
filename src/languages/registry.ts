import fs from 'node:fs';
import path from 'node:path';
import { glob } from 'glob';

export interface LanguageConfig {
  id: string;
  name: string;
  extensions: string[];
  configFiles: string[];
  readDependencies: (rootDir: string) => Promise<string[]>;
  supportsScanning: boolean;
}

export interface DetectedLanguage {
  config: LanguageConfig;
  signal: 'config' | 'extension';
  configFile?: string;
}

import { JAVASCRIPT_CONFIG } from './javascript.js';
import { PYTHON_CONFIG } from './python.js';
import { CSHARP_CONFIG } from './csharp.js';
import { JAVA_CONFIG } from './java.js';

export const LANGUAGE_REGISTRY: LanguageConfig[] = [
  JAVASCRIPT_CONFIG,
  PYTHON_CONFIG,
  CSHARP_CONFIG,
  JAVA_CONFIG
];

export async function detectLanguage(rootDir: string): Promise<DetectedLanguage | null> {
  const all = await detectAllLanguages(rootDir);
  return all[0] ?? null;
}

export async function detectAllLanguages(rootDir: string): Promise<DetectedLanguage[]> {
  const detected: DetectedLanguage[] = [];

  for (const config of LANGUAGE_REGISTRY) {
    for (const configFile of config.configFiles) {
      const hasGlob = configFile.includes('*');
      if (hasGlob) {
        const matches = await glob(configFile, { cwd: rootDir, nodir: true });
        if (matches.length > 0) {
          detected.push({ config, signal: 'config', configFile: matches[0] });
          break;
        }
      } else if (fs.existsSync(path.join(rootDir, configFile))) {
        detected.push({ config, signal: 'config', configFile });
        break;
      }
    }
  }

  if (detected.length > 0) return detected;

  const extensionCounts = await countExtensions(rootDir);
  for (const config of LANGUAGE_REGISTRY) {
    const count = config.extensions.reduce((sum, ext) => sum + (extensionCounts.get(ext) ?? 0), 0);
    if (count > 0) {
      detected.push({ config, signal: 'extension' });
    }
  }

  detected.sort((a, b) => {
    const countA = a.config.extensions.reduce((sum, ext) => sum + (extensionCounts.get(ext) ?? 0), 0);
    const countB = b.config.extensions.reduce((sum, ext) => sum + (extensionCounts.get(ext) ?? 0), 0);
    return countB - countA;
  });

  return detected;
}

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'coverage', '__pycache__', '.venv', 'venv', 'env', 'bin', 'obj', '.turbo']);

async function countExtensions(rootDir: string): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  const allExtensions = new Set(LANGUAGE_REGISTRY.flatMap((c) => c.extensions));

  function walk(dir: string, depth: number): void {
    if (depth > 4) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) {
          walk(path.join(dir, entry.name), depth + 1);
        }
      } else {
        const ext = path.extname(entry.name);
        if (allExtensions.has(ext)) {
          counts.set(ext, (counts.get(ext) ?? 0) + 1);
        }
      }
    }
  }

  walk(rootDir, 0);
  return counts;
}
