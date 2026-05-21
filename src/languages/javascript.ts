import fs from 'node:fs/promises';
import path from 'node:path';
import type { LanguageConfig } from './registry.js';

export const JAVASCRIPT_CONFIG: LanguageConfig = {
  id: 'javascript',
  name: 'JavaScript/TypeScript',
  extensions: ['.js', '.jsx', '.ts', '.tsx'],
  configFiles: ['package.json'],
  supportsScanning: 'full',
  commentSyntax: { line: ['//'], blockStart: '/*', blockEnd: '*/' },

  async readDependencies(rootDir: string): Promise<string[]> {
    try {
      const contents = await fs.readFile(path.join(rootDir, 'package.json'), 'utf8');
      const parsed = JSON.parse(contents) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };

      return [...Object.keys(parsed.dependencies ?? {}), ...Object.keys(parsed.devDependencies ?? {})].map(getPackageName);
    } catch {
      return [];
    }
  }
};

function getPackageName(source: string): string {
  return source.startsWith('@') ? source.split('/').slice(0, 2).join('/') : source.split('/')[0] ?? source;
}
