import { formatName } from '../lib/format';

export function NestedCard({ name }: { name: string }) {
  return <div>{formatName(name)}</div>;
}
