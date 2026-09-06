export function handlerB(input: string) {
  const trimmed = input.trim();
  if (trimmed.length === 0) return null;
  const upper = trimmed.toUpperCase();
  const parts = upper.split(',');
  return parts.map((part) => part.trim()).filter(Boolean);
}
