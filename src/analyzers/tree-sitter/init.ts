import { createRequire } from 'node:module';

import { Parser, Language } from 'web-tree-sitter';

const require = createRequire(import.meta.url);

let initialized = false;
const parserCache = new Map<string, Parser>();

const GRAMMAR_PACKAGES: Record<string, string> = {
  python: 'tree-sitter-python/tree-sitter-python.wasm',
  csharp: 'tree-sitter-c-sharp/tree-sitter-c_sharp.wasm',
  java: 'tree-sitter-java/tree-sitter-java.wasm',
};

export async function getParser(languageId: string): Promise<Parser> {
  const cached = parserCache.get(languageId);
  if (cached) return cached;

  if (!initialized) {
    await Parser.init({
      locateFile: () => require.resolve('web-tree-sitter/web-tree-sitter.wasm')
    });
    initialized = true;
  }

  const grammarPath = GRAMMAR_PACKAGES[languageId];
  if (!grammarPath) {
    throw new Error(`No tree-sitter grammar available for language: ${languageId}`);
  }

  const parser = new Parser();
  const language = await Language.load(require.resolve(grammarPath));
  parser.setLanguage(language);
  parserCache.set(languageId, parser);
  return parser;
}

export type { Parser };
