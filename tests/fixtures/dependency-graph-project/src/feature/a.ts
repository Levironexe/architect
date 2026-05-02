import { useB } from './b';
import { formatName } from '../shared/format';

export function useA(name: string): string {
  return formatName(`${name}:${useB()}`);
}

export function useAHelper(): string {
  return 'a-helper';
}