# PetCare Hub — Example Project with Architecture Issues

This is a fixture project used to test **architect-cli** analysis capabilities.

## What This Is

PetCare Hub is a pet care management SaaS application with **intentional architecture problems**. It exists to demonstrate what architect-cli can detect and report.

## Tech Stack (Covered Skills)

| Technology | architect-cli Skill |
|---|---|
| Next.js 14 App Router | `nextjs-app-router` |
| Express.js 4 | `express-api` |
| Prisma ORM | `prisma` |
| React 18 | `react` |
| TypeScript | `typescript` |
| Tailwind CSS | `tailwindcss` |
| JWT Auth | `auth-jwt` |
| PostgreSQL | `postgresql` |
| Nodemailer | (email) |
| Socket.io | (websockets) |

## Intentional Anti-Patterns

### Architecture
- **Two backends** — Next.js API routes AND Express server, both connecting to the same DB
- **5 PrismaClient instances** — no singleton pattern used in API routes
- **God files** — `page.tsx` (700+ lines), `dashboard/page.tsx` (600+ lines), `server/index.ts` (700+ lines)
- **No service layer** — business logic in route handlers and React components

### YAGNI
- 4 ORMs in `package.json` (Prisma, Sequelize, Mongoose, TypeORM, Knex)
- 3 state managers (Zustand, Jotai, Recoil) — none actually used
- 3 date libraries (moment, date-fns, dayjs) — all three used interchangeably
- Redis + Bull queues — set up but workers never defined
- Socket.io — server emits events, client never connects
- PDF export, CSV export — never called from anywhere
- 2FA (TOTP) — stubbed, throws `Error("not implemented")`

### Code Quality
- **5 duplicate email validators** across files
- **4 duplicate password validators** across files
- **3 duplicate `slugify()` functions**
- **3 date formatting approaches** (moment/date-fns/dayjs) mixed
- All `status` fields are raw strings instead of enums
- `User` has 4 name fields: `name`, `firstName`, `lastName`, `displayName`
- `isPremium: Boolean` field duplicates `subscriptionTier` check

### Performance
- N+1 queries in product listing (fetches review count per-product in a loop)
- All pets fetched before client-side filtering (no server-side pagination)
- `"use client"` on the landing page — loses all SSR benefits
- `setInterval` leaks (no cleanup on unmount in landing page)
- Unthrottled scroll event listener

### Security (intentional — do not use in production)
- JWT secret fallback: `"petcarehub-secret-key-123"` 
- Token returned in JSON body (not httpOnly cookie)
- PUT `/api/users` lets client update their own `role` and `subscriptionTier`
- No auth on pet/appointment/product API routes
- Admin routes in Express have no per-route RBAC
- Files uploaded to local disk (path traversal possible)
- MD5 used for hashing (cryptographically broken)

## File Structure

```
petcare-hub/
├── package.json          # 80+ deps — YAGNI overload
├── prisma/
│   └── schema.prisma     # Bad schema (string statuses, duplicate fields)
├── next.config.js        # Ignores TS errors, unoptimized images
├── server/
│   └── index.ts          # Express monolith (~700 lines)
├── src/
│   ├── app/
│   │   ├── page.tsx      # Landing page god component (~700 lines, "use client")
│   │   ├── layout.tsx    # Manual Google Fonts, dangerouslySetInnerHTML
│   │   ├── globals.css   # Duplicate utility classes
│   │   ├── dashboard/
│   │   │   └── page.tsx  # Dashboard god component (~600 lines)
│   │   ├── pets/
│   │   │   ├── page.tsx  # Client-side list page
│   │   │   └── [id]/
│   │   │       └── page.tsx  # Server component with no auth guard
│   │   └── api/
│   │       ├── pets/route.ts         # 1st new PrismaClient()
│   │       ├── appointments/route.ts  # 2nd new PrismaClient()
│   │       ├── users/route.ts         # 3rd new PrismaClient() + security issues
│   │       └── products/route.ts      # 4th new PrismaClient() + N+1 loop
│   ├── components/
│   │   └── PetManager.tsx  # God component — 15 props, 700+ lines
│   ├── hooks/
│   │   └── useEverything.ts  # God hook — WS + polling simultaneously
│   ├── lib/
│   │   ├── db.ts    # Prisma singleton nobody uses + raw pg pool + repos
│   │   ├── auth.ts  # JWT + bcrypt + session + OAuth stubs
│   │   └── utils.ts # 500-line god utils — 3 date libs, duplicate validators
│   └── types/
│       └── index.ts  # All types in one file, many unused (YAGNI)
```
