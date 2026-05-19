// BAD: auth logic mixed with CRUD — should be in separate auth endpoints
// BAD: third PrismaClient instance
// BAD: bcrypt and JWT imported directly in route file

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const prisma = new PrismaClient();

// BAD: secret used directly instead of from a config module
const JWT_SECRET = process.env.JWT_SECRET || "petcarehub-secret-key-123"; // terrible default!

function generateToken(userId: string, email: string, role: string): string {
  // BAD: token never expires in some code paths, inconsistent expiry
  return jwt.sign({ userId, email, role }, JWT_SECRET, { expiresIn: "7d" });
}

function validateEmail(email: string): boolean {
  // BAD: regex duplicated from utils.ts and client-side code (3rd occurrence)
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

function validatePassword(password: string): string | null {
  if (!password || password.length < 8) return "Password must be at least 8 characters";
  if (!/[A-Z]/.test(password)) return "Password must contain at least one uppercase letter";
  if (!/[0-9]/.test(password)) return "Password must contain at least one number";
  return null;
}

// GET /api/users — list users (should require admin)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const email = searchParams.get("email");

    if (id) {
      const user = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          email: true, // BAD: exposing email without auth check
          name: true,
          role: true,
          subscriptionTier: true,
          avatar: true,
          phone: true,
          city: true,
          country: true,
          createdAt: true,
          isActive: true,
          isPremium: true,
          // BAD: not selecting 'password' but also not consistently doing this everywhere
          pets: {
            where: { deletedAt: null },
            select: { id: true, name: true, species: true, imageUrl: true, status: true },
          },
        },
      });

      if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
      return NextResponse.json({ user });
    }

    if (email) {
      const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true, name: true, email: true, role: true },
      });
      return NextResponse.json({ user: user || null });
    }

    // BAD: returning ALL users without pagination or auth check
    const users = await prisma.user.findMany({
      where: { isActive: true, deletedAt: null },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        subscriptionTier: true,
        createdAt: true,
        // BAD: still no password in select, but phone/address shouldn't be public
        phone: true,
        address: true,
      },
      orderBy: { createdAt: "desc" },
      take: 100, // BAD: hardcoded limit of 100
    });

    return NextResponse.json({ users, total: users.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/users — register or login depending on 'action' param
// BAD: using action params instead of separate endpoints
export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action") || "register"; // defaults to register
    const body = await req.json();

    // ---- REGISTER ----
    if (action === "register") {
      // BAD: manual validation for 4th time
      if (!body.email || !validateEmail(body.email)) {
        return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
      }
      const pwError = validatePassword(body.password);
      if (pwError) return NextResponse.json({ error: pwError }, { status: 400 });
      if (!body.name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });

      const existing = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
      if (existing) return NextResponse.json({ error: "Email already in use" }, { status: 409 });

      // BAD: salt rounds hardcoded — should be in config
      const hashedPassword = await bcrypt.hash(body.password, 10);

      const user = await prisma.user.create({
        data: {
          email: body.email.toLowerCase().trim(),
          password: hashedPassword,
          name: body.name.trim(),
          role: "owner",
          isActive: true,
          isVerified: false, // BAD: sending no verification email
          subscriptionTier: "free",
        },
        select: { id: true, email: true, name: true, role: true, subscriptionTier: true, createdAt: true },
      });

      const token = generateToken(user.id, user.email, user.role);

      // BAD: returning token in JSON body instead of setting httpOnly cookie
      return NextResponse.json({ user, token }, { status: 201 });
    }

    // ---- LOGIN ----
    if (action === "login") {
      if (!body.email || !body.password) {
        return NextResponse.json({ error: "Email and password required" }, { status: 400 });
      }

      const user = await prisma.user.findUnique({
        where: { email: body.email.toLowerCase() },
      });

      if (!user || !user.isActive || user.deletedAt) {
        // BAD: timing attack — different code paths for "not found" vs "wrong password"
        return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
      }

      if (user.lockedUntil && user.lockedUntil > new Date()) {
        return NextResponse.json({
          error: `Account locked until ${user.lockedUntil.toLocaleString()}`
        }, { status: 403 });
      }

      const passwordMatch = await bcrypt.compare(body.password, user.password);
      if (!passwordMatch) {
        // BAD: updating failed login count but not properly implementing lockout
        await prisma.user.update({
          where: { id: user.id },
          data: {
            failedLoginAttempts: user.failedLoginAttempts + 1,
            lockedUntil: user.failedLoginAttempts >= 4 ? new Date(Date.now() + 15 * 60 * 1000) : undefined,
          },
        });
        return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
      }

      // Reset failed attempts on success
      await prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null, lastLogin: new Date(), loginCount: user.loginCount + 1 },
      });

      const token = generateToken(user.id, user.email, user.role);

      return NextResponse.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          subscriptionTier: user.subscriptionTier,
          isPremium: user.isPremium,
          avatar: user.avatar,
        },
        token, // BAD: token in response body instead of secure cookie
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error: any) {
    console.error("POST /api/users:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT /api/users — update user profile
export async function PUT(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) return NextResponse.json({ error: "User ID required" }, { status: 400 });

    // BAD: no auth check — anyone can update any user's profile
    const body = await req.json();
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // BAD: allowing update of 'role' and 'subscriptionTier' from client — SECURITY ISSUE
    const user = await prisma.user.update({
      where: { id },
      data: {
        name: body.name?.trim() || existing.name,
        phone: body.phone?.trim() || existing.phone,
        address: body.address?.trim() || existing.address,
        city: body.city?.trim() || existing.city,
        country: body.country?.trim() || existing.country,
        bio: body.bio?.trim() || existing.bio,
        avatar: body.avatar || existing.avatar,
        role: body.role || existing.role,              // SECURITY: should not be updatable by user
        subscriptionTier: body.subscriptionTier || existing.subscriptionTier, // SECURITY: should not be updatable by user
        preferences: body.preferences || existing.preferences,
      },
      select: { id: true, email: true, name: true, role: true, subscriptionTier: true, avatar: true, phone: true, bio: true },
    });

    return NextResponse.json({ user });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/users
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const permanent = searchParams.get("permanent") === "true";

    if (!id) return NextResponse.json({ error: "User ID required" }, { status: 400 });

    // BAD: no auth check, no admin check for permanent deletion
    if (permanent) {
      // BAD: permanently deleting user and all related data in cascade without warnings
      await prisma.user.delete({ where: { id } });
    } else {
      await prisma.user.update({
        where: { id },
        data: { deletedAt: new Date(), isActive: false },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
