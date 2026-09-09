import type { User } from '@acme/db';

export default function TypesPage({ user }: { user: User }) {
  return <div>{user.name}</div>;
}
