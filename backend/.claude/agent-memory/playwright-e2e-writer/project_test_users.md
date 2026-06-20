---
name: project_test_users
description: Seeded test credentials for Playwright — created by backend/prisma/seed-test.ts
metadata:
  type: project
---

Test users are created by running `backend/prisma/seed-test.ts`. They are defined in `frontend/e2e/tests/fixtures/auth.ts` as the `USERS` constant.

| Role | Email | Password | Name |
|---|---|---|---|
| ADMIN | admin@test.com | Admin@731 | Admin |
| AGENT | agent@test.com | agent@731 | Agent |

Before running Playwright tests, run the seed:
```bash
cd backend && npx tsx prisma/seed-test.ts
```

**Why:** Sign-up is disabled in production auth config. Tests can only log in with pre-seeded accounts. The seed script is idempotent — it skips users that already exist.
**How to apply:** Always reference `USERS.admin` and `USERS.agent` from the fixtures file rather than hardcoding credentials in spec files.
