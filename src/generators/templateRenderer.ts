import type { TemplateContext } from '../types/generation.js';

const TOKEN_PATTERN = /{{\s*([\w.]+)\s*}}/g;

export function render(template: string, context: TemplateContext): string {
  return template.replace(TOKEN_PATTERN, (_token, path) => {
    const value = resolvePath(context, path);

    if (value === undefined || value === null) {
      return '';
    }

    return String(value);
  });
}

function resolvePath(context: TemplateContext, path: string): unknown {
  return path.split('.').reduce<unknown>((current, segment) => {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }

    return (current as Record<string, unknown>)[segment];
  }, context);
}