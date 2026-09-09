import { prisma } from '@acme/db';

export async function listUsers() {
  return prisma.user.findMany();
}
