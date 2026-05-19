// BAD: Express monolith — ALL routes in one 700+ line file
// BAD: No service layer, no controllers, no route separation
// BAD: Auth middleware inline, not in a separate file
// BAD: Redis and Bull queue imported but never used (YAGNI)
// BAD: Socket.io set up but client never connects (YAGNI)
// BAD: Multiple ORMs used (Prisma here vs. Sequelize/Mongoose referenced in package.json)
// BAD: Hardcoded secrets everywhere
// BAD: CORS allows everything in production
// NOTE: This server duplicates the Next.js API routes — two backends for the same data

import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import multer from "multer";
import path from "path";
import fs from "fs";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
// YAGNI: Redis and Bull imported, never wired to anything meaningful
import Redis from "ioredis";
import Bull from "bull";

// BAD: Using lib/db singleton — only place in the codebase that actually does this
// All the Next.js API routes create their OWN PrismaClient instances
import { prisma } from "../src/lib/db";

const app = express();
const httpServer = createServer(app);

// YAGNI: Socket.io setup — client never connects
const io = new SocketIOServer(httpServer, {
  cors: { origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000", methods: ["GET", "POST"] },
});

// YAGNI: Redis client — connected but used for exactly one cache key
const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
redis.on("error", (err) => console.error("Redis error (non-fatal):", err));

// YAGNI: Bull queues — workers never defined
const emailQueue = new Bull("emails", { redis: { port: 6379, host: "localhost" } });
const notificationQueue = new Bull("notifications", { redis: { port: 6379, host: "localhost" } });
const imageQueue = new Bull("images", { redis: { port: 6379, host: "localhost" } });

// BAD: hardcoded secrets
const JWT_SECRET = process.env.JWT_SECRET || "petcarehub-secret-key-123";
const PORT = process.env.SERVER_PORT || 3001;

// ============================================
// MIDDLEWARE
// ============================================

// BAD: helmet with default config — should be customized
app.use(helmet());

// BAD: CORS allows everything — no allowlist in production
app.use(cors({
  origin: process.env.NODE_ENV === "production" ? process.env.ALLOWED_ORIGINS?.split(",") : "*",
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
}));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// BAD: morgan in production logs all requests — PII in URLs
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

// Global rate limiter — BAD: applies same limits to all routes
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: "Too many requests from this IP. Please try again after 15 minutes." },
});
app.use(globalLimiter);

// BAD: file uploads stored in local filesystem — breaks on multi-instance/serverless
const uploadDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  // BAD: filename is just timestamp + original — no sanitization, could overwrite
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  // BAD: no file type validation beyond mimetype (easy to spoof)
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    cb(null, allowed.includes(file.mimetype));
  },
});

// BAD: email transporter at module level — runs on startup, not lazily
const emailTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// ============================================
// AUTH MIDDLEWARE (INLINE — should be in middleware/auth.ts)
// ============================================
interface AuthRequest extends Request {
  userId?: string;
  userRole?: string;
  userEmail?: string;
}

// BAD: same middleware as auth.ts — duplicated
function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;
    req.userId = payload.userId;
    req.userRole = payload.role;
    req.userEmail = payload.email;
    next();
  } catch (err: any) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token expired" });
    }
    return res.status(401).json({ error: "Invalid token" });
  }
}

function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  requireAuth(req, res, () => {
    if (req.userRole !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }
    next();
  });
}

// ============================================
// HEALTH CHECK
// ============================================
app.get("/health", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const redisOk = await redis.ping().then(() => true).catch(() => false);
    res.json({ status: "ok", database: "ok", redis: redisOk ? "ok" : "error", timestamp: new Date().toISOString() });
  } catch {
    res.status(500).json({ status: "error", database: "error" });
  }
});

// ============================================
// AUTH ROUTES (duplicated from Next.js /api/users)
// ============================================
app.post("/api/auth/register", async (req: AuthRequest, res: Response) => {
  try {
    const { email, password, name } = req.body;

    // BAD: validation duplicated from 4 other files (5th occurrence)
    if (!email || !email.includes("@")) return res.status(400).json({ error: "Valid email required" });
    if (!password || password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });
    if (!name?.trim()) return res.status(400).json({ error: "Name required" });

    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) return res.status(409).json({ error: "Email already registered" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        password: hashedPassword,
        name: name.trim(),
        role: "owner",
        subscriptionTier: "free",
        isActive: true,
        isVerified: false,
      },
    });

    const token = jwt.sign({ userId: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: "7d" });

    // BAD: sending email synchronously — blocks response
    try {
      await emailTransporter.sendMail({
        from: process.env.SMTP_FROM || "noreply@petcarehub.com",
        to: user.email,
        subject: "Welcome to PetCare Hub!",
        html: `<h1>Welcome, ${user.name}!</h1><p>Your account has been created. Start by adding your first pet.</p>`,
      });
    } catch (emailErr) {
      console.error("Failed to send welcome email:", emailErr);
      // BAD: silently failing email send — user might never verify
    }

    res.status(201).json({
      token, // BAD: token in response body, not httpOnly cookie
      user: { id: user.id, email: user.email, name: user.name, role: user.role, subscriptionTier: user.subscriptionTier },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/auth/login", async (req: AuthRequest, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password required" });

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user || !user.isActive) return res.status(401).json({ error: "Invalid credentials" });

    // BAD: timing attack possible — should use constant-time compare
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign({ userId: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: "7d" });

    res.json({
      token, // BAD: token in body
      user: { id: user.id, email: user.email, name: user.name, role: user.role, subscriptionTier: user.subscriptionTier, isPremium: user.isPremium },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/auth/logout", requireAuth, async (req: AuthRequest, res: Response) => {
  // BAD: JWT can't be invalidated — this is a no-op
  // Should maintain a token denylist in Redis
  res.json({ success: true, message: "Logged out" });
});

// ============================================
// USER ROUTES
// ============================================
app.get("/api/users/me", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true, email: true, name: true, firstName: true, lastName: true,
        avatar: true, phone: true, bio: true, role: true, subscriptionTier: true,
        isPremium: true, isVerified: true, createdAt: true,
      },
    });
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ user });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/users/me", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { name, firstName, lastName, phone, bio, avatar, website } = req.body;
    const user = await prisma.user.update({
      where: { id: req.userId },
      data: { name, firstName, lastName, phone, bio, avatar, website, updatedAt: new Date() },
      select: { id: true, email: true, name: true, firstName: true, lastName: true, avatar: true, phone: true, bio: true },
    });
    res.json({ user });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// PET ROUTES (duplicated from Next.js /api/pets)
// ============================================
app.get("/api/pets", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id, status, species, search } = req.query as any;

    if (id) {
      const pet = await prisma.pet.findUnique({
        where: { id },
        include: {
          healthRecords: { orderBy: { recordDate: "desc" }, take: 10 },
          vaccinations: { orderBy: { dateGiven: "desc" } },
          medications: { where: { isOngoing: true } },
          weightLogs: { orderBy: { loggedAt: "desc" }, take: 12 },
          appointments: { orderBy: { scheduledAt: "desc" }, take: 5 },
        },
      });
      if (!pet || pet.ownerId !== req.userId) return res.status(404).json({ error: "Pet not found" });
      return res.json({ pet });
    }

    const where: any = { ownerId: req.userId, deletedAt: null };
    if (status) where.status = status;
    if (species) where.species = species;
    if (search) where.name = { contains: search, mode: "insensitive" };

    // BAD: no pagination — fetches ALL pets
    const pets = await prisma.pet.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        // BAD: N+1 replaced by huge include — still inefficient for large pet counts
        appointments: { where: { status: { in: ["pending", "confirmed"] }, scheduledAt: { gte: new Date() } }, take: 1 },
      },
    });

    res.json({ pets, total: pets.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/pets", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { name, species, breed, age, weight, color, gender, imageUrl, microchipId, isNeutered, notes } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: "Pet name required" });
    if (!species) return res.status(400).json({ error: "Species required" });

    const pet = await prisma.pet.create({
      data: {
        name: name.trim(),
        species,
        breed: breed || null,
        age: age ? Number(age) : null,
        weight: weight ? Number(weight) : null,
        color: color || null,
        gender: gender || null,
        imageUrl: imageUrl || null,
        microchipId: microchipId || null,
        isNeutered: Boolean(isNeutered),
        notes: notes || null,
        status: "healthy",
        ownerId: req.userId!,
      },
    });

    // YAGNI: push event to Bull queue — worker never processes it
    await notificationQueue.add({ type: "pet_added", userId: req.userId, petName: pet.name }).catch(() => {});

    res.status(201).json({ pet });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/pets/:id", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await prisma.pet.findUnique({ where: { id } });
    if (!existing || existing.ownerId !== req.userId) return res.status(404).json({ error: "Pet not found" });

    const { name, species, breed, age, weight, color, gender, imageUrl, status, notes } = req.body;
    const pet = await prisma.pet.update({
      where: { id },
      data: {
        name: name?.trim() || existing.name,
        species: species || existing.species,
        breed: breed !== undefined ? breed : existing.breed,
        age: age !== undefined ? (age ? Number(age) : null) : existing.age,
        weight: weight !== undefined ? (weight ? Number(weight) : null) : existing.weight,
        color: color !== undefined ? color : existing.color,
        gender: gender !== undefined ? gender : existing.gender,
        imageUrl: imageUrl !== undefined ? imageUrl : existing.imageUrl,
        status: status || existing.status,
        notes: notes !== undefined ? notes : existing.notes,
        updatedAt: new Date(),
      },
    });

    res.json({ pet });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/pets/:id", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const pet = await prisma.pet.findUnique({ where: { id } });
    if (!pet || pet.ownerId !== req.userId) return res.status(404).json({ error: "Pet not found" });
    await prisma.pet.update({ where: { id }, data: { deletedAt: new Date() } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// APPOINTMENT ROUTES (duplicated from Next.js)
// ============================================
app.get("/api/appointments", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { petId, status, upcoming } = req.query as any;
    const where: any = { userId: req.userId };
    if (petId) where.petId = petId;
    if (status) where.status = status;
    if (upcoming === "true") where.scheduledAt = { gte: new Date() };

    const appointments = await prisma.appointment.findMany({
      where,
      orderBy: { scheduledAt: "asc" },
      include: { pet: { select: { id: true, name: true, species: true } } },
    });

    res.json({ appointments });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/appointments", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { petId, title, type, scheduledAt, vetName, clinicName, notes, cost } = req.body;
    if (!petId) return res.status(400).json({ error: "Pet ID required" });
    if (!title?.trim()) return res.status(400).json({ error: "Title required" });
    if (!scheduledAt) return res.status(400).json({ error: "Date required" });

    const pet = await prisma.pet.findUnique({ where: { id: petId } });
    if (!pet || pet.ownerId !== req.userId) return res.status(404).json({ error: "Pet not found" });

    const appointment = await prisma.appointment.create({
      data: {
        petId,
        userId: req.userId!,
        title: title.trim(),
        type: type || null,
        scheduledAt: new Date(scheduledAt),
        vetName: vetName || null,
        clinicName: clinicName || null,
        notes: notes || null,
        cost: cost ? Number(cost) : null,
        status: "pending",
      },
      include: { pet: { select: { id: true, name: true } } },
    });

    // BAD: same email-on-POST pattern as Next.js route — still synchronous
    try {
      const user = await prisma.user.findUnique({ where: { id: req.userId } });
      if (user) {
        await emailTransporter.sendMail({
          from: process.env.SMTP_FROM || "noreply@petcarehub.com",
          to: user.email,
          subject: `Appointment Confirmed: ${title}`,
          html: `<h2>Appointment Booked</h2><p>Your appointment for <strong>${(appointment as any).pet.name}</strong> has been scheduled for ${new Date(scheduledAt).toLocaleString()}.</p>`,
        });
      }
    } catch (emailErr) {
      console.error("Failed to send confirmation email:", emailErr);
    }

    // YAGNI: emit WebSocket event — nobody is listening server-side
    io.to(`user:${req.userId}`).emit("appointment_created", appointment);

    res.status(201).json({ appointment });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.patch("/api/appointments/:id/status", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const validStatuses = ["pending", "confirmed", "completed", "cancelled", "no_show"];
    if (!validStatuses.includes(status)) return res.status(400).json({ error: "Invalid status" });

    const existing = await prisma.appointment.findUnique({ where: { id } });
    if (!existing || existing.userId !== req.userId) return res.status(404).json({ error: "Appointment not found" });

    const appointment = await prisma.appointment.update({ where: { id }, data: { status, updatedAt: new Date() } });
    res.json({ appointment });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// PRODUCT ROUTES
// ============================================
app.get("/api/products", async (req: Request, res: Response) => {
  try {
    const { category, featured, search, species, minPrice, maxPrice, inStock, limit = "20", page = "1" } = req.query as any;

    // YAGNI: Redis caching that only ever hits for featured products
    const cacheKey = `products:${JSON.stringify(req.query)}`;
    const cached = await redis.get(cacheKey).catch(() => null);
    if (cached) {
      return res.json(JSON.parse(cached));
    }

    const where: any = { isActive: true };
    if (category) where.category = category;
    if (featured === "true") where.isFeatured = true;
    if (inStock === "true") where.stock = { gt: 0 };
    if (search) where.OR = [{ name: { contains: search, mode: "insensitive" } }, { description: { contains: search, mode: "insensitive" } }];
    if (species) where.petSpecies = { has: species };
    if (minPrice || maxPrice) { where.price = {}; if (minPrice) where.price.gte = Number(minPrice); if (maxPrice) where.price.lte = Number(maxPrice); }

    const total = await prisma.product.count({ where });
    const products = await prisma.product.findMany({
      where,
      orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
    });

    const response = { products, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) };

    // BAD: caching with no invalidation strategy
    await redis.setex(cacheKey, 300, JSON.stringify(response)).catch(() => {});

    res.json(response);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// FILE UPLOAD ROUTE
// ============================================
app.post("/api/upload", requireAuth, upload.single("file"), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    // BAD: serving files from local disk — breaks on serverless/multi-instance
    const fileUrl = `${process.env.API_URL || "http://localhost:3001"}/uploads/${req.file.filename}`;

    res.json({ url: fileUrl, filename: req.file.filename, size: req.file.size });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Serve uploaded files — BAD: no CDN, no caching headers
app.use("/uploads", express.static(uploadDir));

// ============================================
// NEWSLETTER / EMAIL CAPTURE
// ============================================
const newsletterEmails: string[] = []; // BAD: in-memory array, lost on restart

app.post("/api/newsletter/subscribe", async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email || !email.includes("@")) return res.status(400).json({ error: "Valid email required" });

    // BAD: no persistence, no deduplication
    if (newsletterEmails.includes(email)) return res.status(409).json({ error: "Already subscribed" });
    newsletterEmails.push(email);

    // BAD: fire and forget email with no error recovery
    emailTransporter.sendMail({
      from: process.env.SMTP_FROM || "noreply@petcarehub.com",
      to: email,
      subject: "You're subscribed to PetCare Hub updates!",
      html: "<p>Thanks for subscribing! We'll keep you updated on new features and pet care tips.</p>",
    }).catch(console.error);

    res.json({ success: true, message: "Subscribed successfully" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ADMIN ROUTES — should be a separate router
// ============================================
app.get("/api/admin/stats", requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    // BAD: 6 separate queries instead of using $transaction
    const totalUsers = await prisma.user.count({ where: { deletedAt: null } });
    const totalPets = await prisma.pet.count({ where: { deletedAt: null } });
    const totalAppointments = await prisma.appointment.count();
    const totalProducts = await prisma.product.count({ where: { isActive: true } });
    const totalOrders = await prisma.order.count();
    const recentUsers = await prisma.user.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, email: true, name: true, role: true, subscriptionTier: true, createdAt: true },
    });

    res.json({ totalUsers, totalPets, totalAppointments, totalProducts, totalOrders, recentUsers });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/admin/users", requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { page = "1", limit = "20", role, search } = req.query as any;
    const where: any = { deletedAt: null };
    if (role) where.role = role;
    if (search) where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];

    const users = await prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
      select: { id: true, email: true, name: true, role: true, subscriptionTier: true, isActive: true, isVerified: true, createdAt: true },
    });
    const total = await prisma.user.count({ where });

    res.json({ users, total });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.patch("/api/admin/users/:id/status", requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { isActive, role, subscriptionTier } = req.body;
    const user = await prisma.user.update({
      where: { id },
      data: { isActive, role, subscriptionTier, updatedAt: new Date() },
    });
    res.json({ user: { id: user.id, email: user.email, isActive: user.isActive, role: user.role } });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// YAGNI: Socket.io event handlers — server-side only, no client connecting
// ============================================
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("subscribe", ({ userId }: { userId: string }) => {
    socket.join(`user:${userId}`);
    console.log(`User ${userId} joined their room`);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

// ============================================
// ERROR HANDLING
// ============================================

// BAD: 404 handler too broad — matches API and static routes
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// BAD: error handler exposes error details in production
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error(err);
  res.status(err.status || 500).json({
    error: err.message || "Internal server error",
    stack: process.env.NODE_ENV !== "production" ? err.stack : undefined,
  });
});

// ============================================
// START SERVER
// ============================================
httpServer.listen(PORT, () => {
  console.log(`🚀 PetCare Hub API server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || "development"}`);
  // YAGNI: logging newsletter size on startup
  console.log(`📧 Newsletter subscribers (in-memory): ${newsletterEmails.length}`);
});

export default app;
