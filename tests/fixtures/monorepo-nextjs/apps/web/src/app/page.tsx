import { prisma } from '@acme/db';

export default async function HomePage() {
  const users = await prisma.user.findMany();
  return <div>{users.length}</div>;
}
