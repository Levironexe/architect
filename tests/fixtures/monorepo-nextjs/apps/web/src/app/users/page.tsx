import { listUsers } from '@acme/data';

export default async function UsersPage() {
  const users = await listUsers();
  return <div>{users.length}</div>;
}
