import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  const rows = await prisma.project.findMany();
  return Response.json(rows);
}

export async function POST(request: Request) {
  const body = await request.json();
  const created = await prisma.project.create({ data: body });
  return Response.json(created);
}
