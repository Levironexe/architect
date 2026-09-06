import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

export default async function HomePage() {
  const projects = await db.project.findMany();
  return <div>{projects.length}</div>;
}
