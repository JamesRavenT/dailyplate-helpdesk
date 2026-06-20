# Helpdesk — Claude Code Guide

## Project Structure

```
/
├── frontend/          React 18 + Vite + TypeScript + Tailwind CSS v4
└── backend/           Express + TypeScript + Prisma + PostgreSQL
```

---

## Authentication

**Library:** [Better Auth](https://www.better-auth.com/)

### How it works
- Email/password only. **Sign-up is disabled** — users are created by seeding the database directly. There is no registration flow.
- Sessions are stored in the PostgreSQL `session` table (7-day expiry).
- Roles: `ADMIN` | `AGENT` — stored as a custom field on the `User` model.

### Backend

**Mount point** — `backend/src/index.ts`
```ts
// Must be registered BEFORE express.json() — Better Auth parses its own bodies
app.all('/api/auth/*', toNodeHandler(auth))
```

**Auth config** — `backend/src/lib/auth.ts`
```ts
betterAuth({
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  emailAndPassword: { enabled: true, disableSignUp: true },
  user: {
    additionalFields: {
      role: { type: 'string', defaultValue: 'AGENT', input: false },
      is_active: { type: 'boolean', defaultValue: true, input: false },
    },
  },
  session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
  trustedOrigins: [process.env.FRONTEND_URL ?? 'http://localhost:5173'],
})
```

**Protecting routes** — `backend/src/middleware/auth.ts`
```ts
// Any authenticated user
router.get('/tickets', requireAuth, handler)

// Admin only
router.post('/users', requireAdmin, handler)
```
Both middleware attach `req.user` (typed as `SessionUser`) and `req.sessionId`.

### Frontend

**Auth client** — `frontend/src/lib/auth-client.ts`
```ts
export const authClient = createAuthClient()
// No baseURL needed — Vite proxies /api → http://localhost:3001
```

**Common usage**
```ts
// Check session (React hook)
const { data: session, isPending } = authClient.useSession()

// Sign in
const { error } = await authClient.signIn.email({ email, password })

// Sign out
await authClient.signOut()
```

**Protected routes** — wrap in `ProtectedRoute` (`frontend/src/components/ProtectedRoute.tsx`)
```tsx
<Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
```
Redirects to `/login` when there is no active session.

---

## Frontend UI

**Component library:** shadcn/ui (base-nova style) with `@base-ui/react` primitives  
**Styling:** Tailwind CSS v4 — no `tailwind.config.js`, all config in `src/index.css` via `@theme inline`  
**Path alias:** `@/` → `frontend/src/`

Add components: `npx shadcn@latest add <component>` (run from `frontend/`)

> **Note:** The shadcn CLI detects bun on this machine and fails at the install step. If `add` fails to install packages, run `npm install <packages>` manually. The `add` command itself (for writing component files) works fine.

> **Note:** Any shadcn component used with react-hook-form's `register()` must use `React.forwardRef` so the ref reaches the DOM element. The generated `Input` component has already been patched — use it as the reference.

---

## API Calls (Frontend)

Use **axios** for HTTP requests and **TanStack Query** (`@tanstack/react-query`) for data fetching, caching, and server state management.

```ts
// Define a typed fetcher with axios
async function fetchUsers(): Promise<User[]> {
  const { data } = await axios.get('/api/users')
  return data
}

// Use in a component
const { data, isPending, error } = useQuery({ queryKey: ['users'], queryFn: fetchUsers })
```

`QueryClientProvider` is already set up in `frontend/src/main.tsx`.

---

## Dev Setup

```bash
# Backend
cd backend && npm run dev   # http://localhost:3001

# Frontend
cd frontend && npm run dev  # http://localhost:5173
```

Frontend proxies `/api` and `/health` to the backend — no CORS issues in dev.

---

## Component Testing

**Runner:** Vitest + React Testing Library. Test files live next to the component they test as `<Name>.test.tsx`.

```bash
cd frontend && npm run test:component   # run once (CI)
cd frontend && npm run test:watch       # watch mode (dev)
```

### Writing tests

- Wrap the component under test in `QueryClientProvider` with `retry: false` to prevent TanStack Query from retrying on failure.
- Mock `axios` with a factory so `axios.get` is a `vi.fn()`. Mock `Navbar` (and any other component that depends on auth context) with a no-op.
- Use `findBy*` queries (async) when waiting for data to load; use `getBy*` for content that is already in the DOM.

```tsx
vi.mock('axios', () => ({ default: { get: vi.fn() } }))
vi.mock('../components/Navbar', () => ({ default: () => <nav /> }))

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}
```

> **Note:** Use `happy-dom` (already configured in `vite.config.ts`) — the latest `jsdom` requires Node >= 20.19 but this machine runs 20.15.

---

## E2E Testing

**Always use the `playwright-e2e-writer` agent to write e2e tests** — invoke it via the Agent tool, never write Playwright tests by hand in the main conversation.

Tests live in `e2e/tests/`. The infrastructure (`playwright.config.ts`, `global-setup.ts`, test database) is already configured.

```bash
# Start test database (required before running tests)
docker compose up postgres-test -d

# Run tests
cd e2e && npm test          # headless
cd e2e && npm run test:ui   # interactive
```

Test users (seeded automatically by `global-setup.ts`):

| Email | Password | Role |
|---|---|---|
| admin@test.com | Admin@731 | ADMIN |
| agent@test.com | agent@731 | AGENT |
