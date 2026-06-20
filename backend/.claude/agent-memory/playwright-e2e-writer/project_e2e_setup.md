---
name: project_e2e_setup
description: Playwright config location, testDir layout, auth state paths, installed version
metadata:
  type: project
---

Playwright 1.61.0 is installed as a devDependency in `frontend/package.json`.

Config file: `frontend/playwright.config.ts`
- testDir: `./e2e/tests`
- baseURL: `http://localhost:5173`
- projects: `setup` (matches `auth-setup.ts`) + `chromium` (depends on setup)
- webServer runs `npm run dev` from `frontend/`

Directory layout:
```
frontend/e2e/
├── .auth/             # gitignored — session state files written by auth-setup.ts
│   ├── admin.json
│   └── agent.json
└── tests/
    ├── fixtures/
    │   └── auth.ts    # USERS constants, ADMIN_STATE/AGENT_STATE paths, adminPage/agentPage fixtures
    ├── setup/
    │   └── auth-setup.ts   # global setup — logs in both users and saves storageState
    └── auth.spec.ts         # auth test suite
```

Auth state files are in `frontend/e2e/.auth/` — covered by `frontend/.gitignore`.

**Why:** storageState pattern avoids logging in per-test and keeps tests fast and independent.
**How to apply:** When adding new spec files that need auth, import from `./fixtures/auth` (not `@playwright/test`) to get `adminPage`/`agentPage` fixtures.
