function normalizeInput(input: string): string {
  const cleaned = input.trim().toLowerCase();

  if (!cleaned) {
    return 'missing';
  }

  const segments = cleaned.split(':');
  const primary = segments[0] ?? 'missing';
  const secondary = segments[1] ?? 'fallback';
  const summary = `${primary}-${secondary}`;

  if (summary.length > 20) {
    return summary.slice(0, 20);
  }

  return summary;
}

export function buildAlphaSummary(value: string): string {
  return normalizeInput(value);
}