---
name: project-auth-architecture
description: Better Auth architecture — dual betterAuth instances, role model, session config, middleware chain
metadata:
  type: project
---

Better Auth with Prisma/PostgreSQL adapter. Email+password only, sign-up disabled in main instance (`disableSignUp: true`). A second `seedAuth` instance (signup enabled) lives only in `backend/prisma/seed.ts` — this is the intended seeding pattern.

Roles: `ADMIN` | `AGENT` stored as a Prisma enum on the `User` model and as a Better Auth `additionalField` (string, `input: false`). The `role` field is authoritative in the DB; Better Auth surfaces it on `session.user.role`.

Session: 7-day expiry, 1-day updateAge. Sessions in the `session` table, cascade-deleted on user delete.

Middleware order in `backend/src/index.ts`: auth handler (`app.all('/api/auth/*')`) registered BEFORE `express.json()` — correct per Better Auth requirements.

`requireAuth` and `requireAdmin` in `backend/src/middleware/auth.ts` both call `auth.api.getSession()` independently — each makes a separate DB round-trip. Routes using `requireAdmin` do not compose `requireAuth`, so the session is fetched twice on admin routes if both were ever stacked (currently they are not, so only one call per request).

Frontend: `(session.user as any).role` cast needed because Better Auth does not emit TS types for `additionalFields`. This is a type-safety gap, not a runtime vulnerability.

**Why:** Core architectural decisions around the auth layer. Shape future suggestions around these constraints.
**How to apply:** Any new route must use `requireAuth` or `requireAdmin`. Never trust role from client. BETTER_AUTH_SECRET must be in auth config.
