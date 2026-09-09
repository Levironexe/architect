import { PrismaClient } from '@prisma/client';

export type User = { id: string; name: string };
export const prisma = new PrismaClient();
