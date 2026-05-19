// BAD: All CRUD for pets in one route file — no service layer, no repository pattern
// BAD: Prisma client imported and used directly in the route handler
// BAD: No input validation beyond basic checks
// BAD: Error handling is inconsistent

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

// BAD: creating a new PrismaClient per-import instead of using a singleton
// (there's a singleton in lib/db.ts but nobody uses it here)
const prisma = new PrismaClient();

// GET /api/pets
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const featured = searchParams.get("featured") === "true";
    const limit = parseInt(searchParams.get("limit") || "50");
    const page = parseInt(searchParams.get("page") || "1");
    const species = searchParams.get("species");
    const status = searchParams.get("status");
    const ownerId = searchParams.get("ownerId");
    const search = searchParams.get("search");

    // BAD: building where clause imperatively instead of composing
    const where: any = {
      deletedAt: null,
    };
    if (featured) {
      // BAD: "featured" not a real field — faking it by returning first N pets
      // Should have a featured boolean on the model
    }
    if (species) where.species = species;
    if (status) where.status = status;
    if (ownerId) where.ownerId = ownerId;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { breed: { contains: search, mode: "insensitive" } },
      ];
    }

    // BAD: fetching ALL pets then slicing in JS instead of using DB pagination
    const allPets = await prisma.pet.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        owner: {
          select: { id: true, name: true, email: true }, // BAD: selecting email which shouldn't be public
        },
        appointments: {
          // BAD: N+1 — loading all appointments for all pets
          where: { status: { not: "cancelled" } },
          orderBy: { scheduledAt: "asc" },
          take: 3,
        },
      },
    });

    // Manual pagination after DB fetch — should use skip/take in the query
    const offset = (page - 1) * limit;
    const pets = allPets.slice(offset, offset + limit);
    const total = allPets.length;

    return NextResponse.json({
      pets,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: any) {
    console.error("GET /api/pets error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/pets
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // BAD: manual validation duplicated from dashboard/page.tsx and utils.ts
    if (!body.name || body.name.trim().length < 2) {
      return NextResponse.json({ error: "Pet name must be at least 2 characters" }, { status: 400 });
    }
    if (!body.species) {
      return NextResponse.json({ error: "Species is required" }, { status: 400 });
    }
    if (body.age !== undefined && (isNaN(body.age) || body.age < 0 || body.age > 30)) {
      return NextResponse.json({ error: "Invalid age" }, { status: 400 });
    }

    // BAD: no authentication check — anyone can create pets for any user
    // TODO: get userId from session/JWT
    const userId = body.ownerId || "00000000-0000-0000-0000-000000000000"; // hardcoded fallback!

    const pet = await prisma.pet.create({
      data: {
        name: body.name.trim(),
        species: body.species.toLowerCase(),
        breed: body.breed?.trim() || null,
        age: body.age ? Number(body.age) : null,
        weight: body.weight ? Number(body.weight) : null,
        imageUrl: body.imageUrl || null,
        status: body.status || "healthy",
        notes: body.notes?.trim() || null,
        ownerId: userId,
      },
    });

    // BAD: no audit log created
    return NextResponse.json({ pet }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/pets error:", error);
    // BAD: leaking database error details to client
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT /api/pets/:id — should be in [id]/route.ts
// BAD: update handler in the same file — no dynamic route used
export async function PUT(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Pet ID required" }, { status: 400 });
    }

    const body = await req.json();

    // BAD: no ownership check — any user can update any pet
    const existing = await prisma.pet.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) {
      return NextResponse.json({ error: "Pet not found" }, { status: 404 });
    }

    const pet = await prisma.pet.update({
      where: { id },
      data: {
        name: body.name?.trim() || existing.name,
        species: body.species || existing.species,
        breed: body.breed?.trim() || existing.breed,
        age: body.age !== undefined ? Number(body.age) : existing.age,
        weight: body.weight !== undefined ? Number(body.weight) : existing.weight,
        imageUrl: body.imageUrl !== undefined ? body.imageUrl : existing.imageUrl,
        status: body.status || existing.status,
        notes: body.notes?.trim() !== undefined ? body.notes : existing.notes,
        isNeutered: body.isNeutered !== undefined ? body.isNeutered : existing.isNeutered,
        isVaccinated: body.isVaccinated !== undefined ? body.isVaccinated : existing.isVaccinated,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ pet });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/pets/:id
// BAD: same pattern — should use [id]/route.ts
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const hardDelete = searchParams.get("hard") === "true";

    if (!id) {
      return NextResponse.json({ error: "ID required" }, { status: 400 });
    }

    // BAD: no authorization check
    const existing = await prisma.pet.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Pet not found" }, { status: 404 });
    }

    if (hardDelete) {
      // BAD: allowing hard deletes from the API without any admin check
      await prisma.pet.delete({ where: { id } });
    } else {
      await prisma.pet.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
    }

    return NextResponse.json({ success: true, message: "Pet deleted" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
