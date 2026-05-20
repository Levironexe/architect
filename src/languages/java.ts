import fs from 'node:fs/promises';
import path from 'node:path';
import type { LanguageConfig } from './registry.js';

export const JAVA_CONFIG: LanguageConfig = {
  id: 'java',
  name: 'Java',
  extensions: ['.java'],
  configFiles: ['pom.xml', 'build.gradle', 'build.gradle.kts'],
  supportsScanning: false,

  async readDependencies(rootDir: string): Promise<string[]> {
    const mavenDeps = await readMavenDeps(rootDir);
    if (mavenDeps.length > 0) return mavenDeps;

    const gradleDeps = await readGradleDeps(rootDir);
    if (gradleDeps.length > 0) return gradleDeps;

    return readGradleKtsDeps(rootDir);
  }
};

async function readMavenDeps(rootDir: string): Promise<string[]> {
  try {
    const contents = await fs.readFile(path.join(rootDir, 'pom.xml'), 'utf8');
    const deps: string[] = [];

    const depBlocks = contents.matchAll(/<dependency>\s*([\s\S]*?)<\/dependency>/g);
    for (const block of depBlocks) {
      const groupId = block[1]?.match(/<groupId>(.*?)<\/groupId>/)?.[1];
      const artifactId = block[1]?.match(/<artifactId>(.*?)<\/artifactId>/)?.[1];
      if (groupId && artifactId) {
        deps.push(`${groupId}:${artifactId}`);
        deps.push(artifactId);
      }
    }

    return [...new Set(deps)];
  } catch {
    return [];
  }
}

async function readGradleDeps(rootDir: string): Promise<string[]> {
  try {
    const contents = await fs.readFile(path.join(rootDir, 'build.gradle'), 'utf8');
    return parseGradleDependencies(contents);
  } catch {
    return [];
  }
}

async function readGradleKtsDeps(rootDir: string): Promise<string[]> {
  try {
    const contents = await fs.readFile(path.join(rootDir, 'build.gradle.kts'), 'utf8');
    return parseGradleDependencies(contents);
  } catch {
    return [];
  }
}

function parseGradleDependencies(contents: string): string[] {
  const deps: string[] = [];

  const patterns = [
    /(?:implementation|testImplementation|api|compileOnly|runtimeOnly)\s*\(?["']([^"']+)["']\)?/g,
    /(?:implementation|testImplementation|api|compileOnly|runtimeOnly)\s*\(\s*["']([^"']+)["']\s*\)/g
  ];

  for (const pattern of patterns) {
    for (const match of contents.matchAll(pattern)) {
      const dep = match[1];
      if (!dep) continue;
      deps.push(dep);
      const parts = dep.split(':');
      if (parts.length >= 2 && parts[1]) {
        deps.push(parts[1]);
      }
    }
  }

  return [...new Set(deps)];
}
