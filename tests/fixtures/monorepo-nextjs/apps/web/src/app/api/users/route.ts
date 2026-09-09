import { prisma } from '@acme/db';

export async function GET() {
  return Response.json(await prisma.user.findMany());
}
