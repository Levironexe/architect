// BAD: db.ts is a god file mixing singleton pattern, raw queries, seed functions,
// repository helpers, and migration utilities all in one place.
// BAD: Prisma client singleton pattern implemented incorrectly for Next.js
// (official docs pattern is slightly different)

import { PrismaClient } from "@prisma/client";
import { Pool } from "pg"; // BAD: importing raw pg driver ALONGSIDE Prisma

// Prisma singleton — this is actually correct but everything else in this file isn't
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

// BAD: using debug logging in production — logs all queries
export const prisma =
  global.__prisma ||
  new PrismaClient({
    log: ["query", "error", "warn"], // should only log errors in production
    errorFormat: "pretty",
  });

if (process.env.NODE_ENV !== "production") {
  global.__prisma = prisma;
}

// BAD: raw pg Pool alongside Prisma — pick one!
// "Added for complex joins that Prisma can't handle" - most of them are never used
export const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,          // BAD: connection pool size not tuned for workload
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// ============================================
// RAW SQL QUERIES — mixed with ORM queries elsewhere
// ============================================

export async function rawQuery<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const client = await pgPool.connect();
  try {
    const result = await client.query(sql, params);
    return result.rows;
  } finally {
    client.release();
  }
}

// BAD: specific raw queries defined here instead of using Prisma's typed queries
export async function getUserWithPetsRaw(userId: string): Promise<any> {
  // BAD: SQL injection risk if userId is not properly sanitized
  // (it's parameterized here, but the function name suggests it could be misused)
  return rawQuery(
    `SELECT u.*, json_agg(p.*) as pets
     FROM users u
     LEFT JOIN pets p ON p.owner_id = u.id AND p.deleted_at IS NULL
     WHERE u.id = $1
     GROUP BY u.id`,
    [userId]
  );
}

export async function getAppointmentStatsRaw(startDate: Date, endDate: Date): Promise<any> {
  return rawQuery(
    `SELECT 
       COUNT(*) as total,
       SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
       SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
       SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
       AVG(cost) as avg_cost
     FROM appointments
     WHERE scheduled_at BETWEEN $1 AND $2`,
    [startDate, endDate]
  );
}

// ============================================
// YAGNI: Repository pattern wrappers around Prisma
// Adds zero value — just delegates to Prisma directly
// ============================================
export class UserRepository {
  async findById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  }

  async findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  }

  async create(data: any) {
    return prisma.user.create({ data });
  }

  async update(id: string, data: any) {
    return prisma.user.update({ where: { id }, data });
  }

  async delete(id: string) {
    return prisma.user.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async findAll(options: { skip?: number; take?: number; where?: any } = {}) {
    return prisma.user.findMany({
      where: { ...options.where, deletedAt: null },
      skip: options.skip,
      take: options.take,
    });
  }
}

export class PetRepository {
  async findById(id: string) {
    return prisma.pet.findUnique({
      where: { id },
      include: {
        healthRecords: { orderBy: { recordDate: "desc" } },
        vaccinations: { orderBy: { dateGiven: "desc" } },
        medications: { where: { isOngoing: true } },
      },
    });
  }

  async findByOwnerId(ownerId: string) {
    return prisma.pet.findMany({
      where: { ownerId, deletedAt: null },
      orderBy: { createdAt: "desc" },
    });
  }

  async create(data: any) {
    return prisma.pet.create({ data });
  }

  async update(id: string, data: any) {
    return prisma.pet.update({ where: { id }, data });
  }

  async softDelete(id: string) {
    return prisma.pet.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}

// BAD: instantiating repositories as global singletons
// defeats the purpose of having them as classes
export const userRepository = new UserRepository();
export const petRepository = new PetRepository();

// ============================================
// YAGNI: Database health check — never called
// ============================================
export async function checkDatabaseHealth(): Promise<{
  prisma: boolean;
  postgres: boolean;
  latency: number;
}> {
  const start = Date.now();
  let prismaOk = false;
  let postgresOk = false;

  try {
    await prisma.$queryRaw`SELECT 1`;
    prismaOk = true;
  } catch {
    prismaOk = false;
  }

  try {
    const client = await pgPool.connect();
    await client.query("SELECT 1");
    client.release();
    postgresOk = true;
  } catch {
    postgresOk = false;
  }

  return { prisma: prismaOk, postgres: postgresOk, latency: Date.now() - start };
}

// ============================================
// SEED DATA — should be in prisma/seed.ts, not db.ts
// ============================================
export async function seedDatabase(): Promise<void> {
  console.log("🌱 Seeding database...");

  // BAD: seed function in db.ts — should be in prisma/seed.ts
  const existingAdmin = await prisma.user.findFirst({ where: { role: "admin" } });
  if (!existingAdmin) {
    const bcrypt = await import("bcryptjs");
    const hashedPw = await bcrypt.default.hash("Admin123!", 10);

    await prisma.user.create({
      data: {
        email: "admin@petcarehub.com",
        password: hashedPw,
        name: "Admin User",
        role: "admin",
        subscriptionTier: "enterprise",
        isActive: true,
        isVerified: true,
        isPremium: true,
      },
    });
    console.log("✅ Admin user created");
  }

  // Seed demo user
  const existingDemo = await prisma.user.findFirst({ where: { email: "demo@petcarehub.com" } });
  if (!existingDemo) {
    const bcrypt = await import("bcryptjs");
    const hashedPw = await bcrypt.default.hash("Demo123!", 10);

    const demoUser = await prisma.user.create({
      data: {
        email: "demo@petcarehub.com",
        password: hashedPw,
        name: "Demo User",
        role: "owner",
        subscriptionTier: "premium",
        isActive: true,
        isVerified: true,
      },
    });

    // Seed demo pets
    await prisma.pet.createMany({
      data: [
        { name: "Buddy", species: "dog", breed: "Golden Retriever", age: 3, weight: 28.5, status: "healthy", ownerId: demoUser.id },
        { name: "Luna", species: "cat", breed: "Persian", age: 2, weight: 4.2, status: "healthy", ownerId: demoUser.id },
        { name: "Max", species: "dog", breed: "Labrador", age: 5, weight: 32.1, status: "checkup_needed", ownerId: demoUser.id },
      ],
    });

    console.log("✅ Demo user and pets created");
  }

  console.log("✅ Database seeding complete");
}

// ============================================
// YAGNI: DB migration helpers — never used (Prisma handles migrations)
// ============================================
export async function runMigration(name: string, up: () => Promise<void>): Promise<void> {
  console.log(`Running migration: ${name}`);
  const start = Date.now();
  await up();
  console.log(`Migration ${name} completed in ${Date.now() - start}ms`);
}

// BAD: disconnect never called in most code paths
export async function disconnectDB(): Promise<void> {
  await prisma.$disconnect();
  await pgPool.end();
}
