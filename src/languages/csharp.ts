import fs from 'node:fs/promises';
import { glob } from 'glob';
import type { LanguageConfig } from './registry.js';

export const CSHARP_CONFIG: LanguageConfig = {
  id: 'csharp',
  name: 'C#',
  extensions: ['.cs'],
  configFiles: ['*.csproj', '*.sln'],
  supportsScanning: 'full',
  commentSyntax: { line: ['//'], blockStart: '/*', blockEnd: '*/' },

  async readDependencies(rootDir: string): Promise<string[]> {
    const csprojFiles = await findCsprojFiles(rootDir);
    if (csprojFiles.length === 0) return [];

    const allDeps: string[] = [];
    for (const file of csprojFiles) {
      const deps = await parseCsproj(file);
      allDeps.push(...deps);
    }

    return [...new Set(allDeps)];
  }
};

async function findCsprojFiles(rootDir: string): Promise<string[]> {
  const patterns = ['*.csproj', '*/*.csproj', 'src/*/*.csproj'];
  const files: string[] = [];

  for (const pattern of patterns) {
    const matches = await glob(pattern, { cwd: rootDir, nodir: true, absolute: true });
    files.push(...matches);
  }

  return [...new Set(files)];
}

async function parseCsproj(filePath: string): Promise<string[]> {
  try {
    const contents = await fs.readFile(filePath, 'utf8');
    const deps: string[] = [];

    const packageRefs = contents.matchAll(/<PackageReference\s+Include="([^"]+)"/g);
    for (const match of packageRefs) {
      if (match[1]) deps.push(match[1]);
    }

    const frameworkRefs = contents.matchAll(/<FrameworkReference\s+Include="([^"]+)"/g);
    for (const match of frameworkRefs) {
      if (match[1]) deps.push(match[1]);
    }

    const sdkMatch = contents.match(/<Project\s+Sdk="([^"]+)"/);
    if (sdkMatch?.[1]?.includes('Microsoft.NET.Sdk.Web')) {
      deps.push('Microsoft.AspNetCore');
    }

    return deps;
  } catch {
    return [];
  }
}
