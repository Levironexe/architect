// BAD: All product CRUD in one file with no separation
// BAD: 4th PrismaClient instance in this codebase

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// BAD: helper duplicated from utils.ts
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// BAD: pricing logic inline in the route
function calculateDiscount(price: number, compareAtPrice?: number | null): number {
  if (!compareAtPrice || compareAtPrice <= price) return 0;
  return Math.round(((compareAtPrice - price) / compareAtPrice) * 100);
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const category = searchParams.get("category");
    const featured = searchParams.get("featured") === "true";
    const search = searchParams.get("search");
    const species = searchParams.get("species");
    const minPrice = searchParams.get("minPrice");
    const maxPrice = searchParams.get("maxPrice");
    const inStock = searchParams.get("inStock") === "true";
    const limit = parseInt(searchParams.get("limit") || "20");
    const page = parseInt(searchParams.get("page") || "1");
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortOrder = searchParams.get("sortOrder") || "desc";

    if (id) {
      const product = await prisma.product.findUnique({
        where: { id },
        include: {
          reviews: {
            where: { isApproved: true },
            include: { user: { select: { name: true, avatar: true } } },
            orderBy: { createdAt: "desc" },
          },
        },
      });
      if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

      // BAD: computing derived data on every request instead of storing it
      const avgRating = (product as any).reviews.length > 0
        ? (product as any).reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / (product as any).reviews.length
        : null;

      return NextResponse.json({
        product: {
          ...product,
          avgRating,
          discountPercent: calculateDiscount(product.price, product.compareAtPrice),
        },
      });
    }

    const where: any = { isActive: true };
    if (category) where.category = category;
    if (featured) where.isFeatured = true;
    if (inStock) where.stock = { gt: 0 };
    if (search) where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
      { brand: { contains: search, mode: "insensitive" } },
    ];
    if (species) where.petSpecies = { has: species };
    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) where.price.gte = Number(minPrice);
      if (maxPrice) where.price.lte = Number(maxPrice);
    }

    // BAD: fetching total count separately (2 queries) instead of using Prisma's count
    const total = await prisma.product.count({ where });
    const products = await prisma.product.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
    });

    // BAD: N+1 — fetching review count per product in a loop
    const productsWithStats = await Promise.all(
      products.map(async (product) => {
        const reviewCount = await prisma.review.count({ where: { productId: product.id } });
        const reviews = await prisma.review.findMany({ where: { productId: product.id, isApproved: true }, select: { rating: true } });
        const avgRating = reviews.length > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : null;
        return { ...product, reviewCount, avgRating, discountPercent: calculateDiscount(product.price, product.compareAtPrice) };
      })
    );

    return NextResponse.json({ products: productsWithStats, total, page, totalPages: Math.ceil(total / limit) });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // BAD: validation duplicated from other files (5th occurrence of similar pattern)
    if (!body.name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });
    if (!body.category) return NextResponse.json({ error: "Category required" }, { status: 400 });
    if (body.price === undefined || isNaN(Number(body.price)) || Number(body.price) < 0) {
      return NextResponse.json({ error: "Valid price required" }, { status: 400 });
    }

    // Generate slug — should check for uniqueness
    let slug = slugify(body.name);
    const existing = await prisma.product.findUnique({ where: { slug } });
    if (existing) {
      // BAD: appending random number — could still collide
      slug = `${slug}-${Math.floor(Math.random() * 1000)}`;
    }

    const product = await prisma.product.create({
      data: {
        name: body.name.trim(),
        slug,
        description: body.description?.trim() || null,
        shortDescription: body.shortDescription?.trim() || null,
        sku: body.sku?.trim() || null,
        category: body.category,
        subcategory: body.subcategory || null,
        brand: body.brand?.trim() || null,
        price: Number(body.price),
        compareAtPrice: body.compareAtPrice ? Number(body.compareAtPrice) : null,
        stock: body.stock ? Number(body.stock) : 0,
        imageUrl: body.imageUrl || null,
        imageUrls: body.imageUrls || [],
        tags: body.tags || [],
        petSpecies: body.petSpecies || [],
        isActive: body.isActive !== undefined ? body.isActive : true,
        isFeatured: body.isFeatured || false,
      },
    });

    return NextResponse.json({ product }, { status: 201 });
  } catch (error: any) {
    if (error.code === "P2002") {
      return NextResponse.json({ error: "A product with this SKU already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    const body = await req.json();
    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    const product = await prisma.product.update({
      where: { id },
      data: {
        name: body.name?.trim() || existing.name,
        description: body.description !== undefined ? body.description : existing.description,
        price: body.price !== undefined ? Number(body.price) : existing.price,
        compareAtPrice: body.compareAtPrice !== undefined ? (body.compareAtPrice ? Number(body.compareAtPrice) : null) : existing.compareAtPrice,
        stock: body.stock !== undefined ? Number(body.stock) : existing.stock,
        imageUrl: body.imageUrl !== undefined ? body.imageUrl : existing.imageUrl,
        isActive: body.isActive !== undefined ? body.isActive : existing.isActive,
        isFeatured: body.isFeatured !== undefined ? body.isFeatured : existing.isFeatured,
        category: body.category || existing.category,
        tags: body.tags || existing.tags,
        petSpecies: body.petSpecies || existing.petSpecies,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ product });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    // Soft delete — BAD: no admin auth check
    await prisma.product.update({ where: { id }, data: { isActive: false } });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
