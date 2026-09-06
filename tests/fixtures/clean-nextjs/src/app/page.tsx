import { listUsers } from '../lib/users';
import { UsersTable } from '../components/UsersTable';

export default async function HomePage() {
  const users = await listUsers();
  return <UsersTable users={users} />;
}
