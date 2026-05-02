import { useAHelper } from './a';

export function useB(): string {
  return `b-uses-${useAHelper()}`;
}