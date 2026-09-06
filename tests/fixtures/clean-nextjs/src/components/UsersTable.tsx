import type { User } from '../lib/users';

export function UsersTable({ users }: { users: User[] }) {
  return <ul>{users.map((user) => <li key={user.id}>{user.name}</li>)}</ul>;
}
