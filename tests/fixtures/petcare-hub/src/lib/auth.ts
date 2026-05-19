// BAD: auth.ts god file — mixes JWT, bcrypt, session, OAuth, middleware, and helpers
// BAD: weak defaults, hardcoded secrets
// BAD: multiple auth strategies partially implemented

import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "./db";

// BAD: weak secret with terrible fallback
const JWT_SECRET = process.env.JWT_SECRET || "petcarehub-secret-key-123";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "petcarehub-refresh-secret-456";
const SALT_ROUNDS = 10; // BAD: should be configurable, 10 is too low for modern hardware

// ============================================
// JWT UTILITIES
// ============================================
export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

export function signToken(payload: Omit<TokenPayload, "iat" | "exp">, expiresIn = "7d"): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn } as any);
}

export function signRefreshToken(payload: Omit<TokenPayload, "iat" | "exp">): string {
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: "30d" } as any);
}

export function verifyToken(token: string): TokenPayload {
  // BAD: throws error instead of returning null — callers need try/catch everywhere
  return jwt.verify(token, JWT_SECRET) as TokenPayload;
}

export function verifyRefreshToken(token: string): TokenPayload {
  return jwt.verify(token, JWT_REFRESH_SECRET) as TokenPayload;
}

export function decodeToken(token: string): TokenPayload | null {
  try {
    return jwt.decode(token) as TokenPayload;
  } catch {
    return null;
  }
}

// BAD: extracting token from request in 3 different ways across the codebase
export function extractToken(req: NextRequest): string | null {
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  // Also check cookie
  const cookieToken = req.cookies.get("auth_token")?.value;
  if (cookieToken) return cookieToken;

  // Also check query param (BAD: tokens in URLs are logged!)
  const url = new URL(req.url);
  const queryToken = url.searchParams.get("token");
  if (queryToken) return queryToken;

  return null;
}

// ============================================
// PASSWORD UTILITIES
// ============================================
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(plain: string, hashed: string): Promise<boolean> {
  return bcrypt.compare(plain, hashed);
}

// BAD: password validation duplicated from utils.ts and api/users/route.ts (3rd occurrence)
export function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!password || password.length < 8) errors.push("At least 8 characters");
  if (!/[A-Z]/.test(password)) errors.push("At least one uppercase letter");
  if (!/[a-z]/.test(password)) errors.push("At least one lowercase letter");
  if (!/[0-9]/.test(password)) errors.push("At least one number");
  return { valid: errors.length === 0, errors };
}

// ============================================
// AUTH MIDDLEWARE
// ============================================

// BAD: middleware returns mixed types — should return consistent Response
export async function requireAuth(req: NextRequest): Promise<{ userId: string; role: string } | NextResponse> {
  const token = extractToken(req);

  if (!token) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    const payload = verifyToken(token);

    // BAD: no check if user still exists in DB (could use deleted/banned user's token)
    // TODO: uncomment this:
    // const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    // if (!user || !user.isActive || user.deletedAt) {
    //   return NextResponse.json({ error: "User not found or inactive" }, { status: 401 });
    // }

    return { userId: payload.userId, role: payload.role };
  } catch (err: any) {
    if (err.name === "TokenExpiredError") {
      return NextResponse.json({ error: "Token expired. Please log in again." }, { status: 401 });
    }
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }
}

export async function requireAdmin(req: NextRequest): Promise<{ userId: string; role: string } | NextResponse> {
  const authResult = await requireAuth(req);

  if (authResult instanceof NextResponse) return authResult;

  if (authResult.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  return authResult;
}

// ============================================
// SESSION MANAGEMENT — partially implemented, mostly unused
// ============================================
export async function createSession(userId: string, ipAddress?: string, userAgent?: string): Promise<string> {
  const token = require("crypto").randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await prisma.session.create({
    data: {
      userId,
      token,
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
      expiresAt,
    },
  });

  return token;
}

export async function validateSession(token: string): Promise<{ userId: string } | null> {
  const session = await prisma.session.findUnique({ where: { token } });
  if (!session) return null;
  if (session.expiresAt < new Date()) {
    // BAD: deleting expired session synchronously on every request
    await prisma.session.delete({ where: { token } });
    return null;
  }
  return { userId: session.userId };
}

export async function deleteSession(token: string): Promise<void> {
  await prisma.session.delete({ where: { token } }).catch(() => {
    // Ignore error if session doesn't exist
  });
}

export async function deleteAllUserSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } });
}

// ============================================
// OAUTH — partially stubbed, never finished
// ============================================
export interface OAuthProfile {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  provider: "google" | "facebook" | "apple";
}

// BAD: OAuth handler partially implemented, never called from anywhere
export async function handleOAuthLogin(profile: OAuthProfile): Promise<{ user: any; token: string; isNew: boolean }> {
  let user = await prisma.user.findUnique({ where: { email: profile.email.toLowerCase() } });
  let isNew = false;

  if (!user) {
    isNew = true;
    // BAD: creating user without password for OAuth — should use a separate field
    user = await prisma.user.create({
      data: {
        email: profile.email.toLowerCase(),
        password: "", // BAD: empty password
        name: profile.name,
        avatar: profile.avatar || null,
        isActive: true,
        isVerified: true, // BAD: assuming OAuth email is verified
        role: "owner",
        subscriptionTier: "free",
      },
    });
  }

  const token = signToken({ userId: user.id, email: user.email, role: user.role });
  return { user, token, isNew };
}

// ============================================
// YAGNI: Two-factor auth — never implemented
// ============================================
export function generateTOTPSecret(): string {
  // TODO: implement TOTP with speakeasy or otpauth
  throw new Error("2FA not implemented");
}

export function verifyTOTP(secret: string, token: string): boolean {
  // TODO: implement TOTP verification
  throw new Error("2FA not implemented");
}
