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

## Backend Validation

Use **Zod** (`zod` is already installed in `backend/`) to validate request bodies in controllers. Define a schema at module scope and use `safeParse` — return the first issue message as `{ error: string }` with a 400 status.

```ts
import { z } from 'zod'

const createFooSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters'),
  email: z.string().email('Enter a valid email'),
})

export async function createFoo(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = createFooSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message })
    }
    const { name, email } = parsed.data
    // ...
  } catch (err) { next(err) }
}
```

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

## Dashboard (Home Page)

**File:** `frontend/src/pages/Home.tsx`

Two role-branched dashboards rendered by the same page:

| Role | Sections |
|---|---|
| ADMIN | Activity chart (4 lines) → 5 stat cards → New Tickets slideshow → Online Agents list |
| AGENT | Activity chart (2 lines) → 4 stat cards → New Tickets slideshow → Recent Tickets slideshow |

**Chart library:** `recharts` — `AreaChart` inside `ResponsiveContainer`. Installed in `frontend/`.

**Chart colors:**
```ts
const CHART_COLORS = {
  received: '#6366f1', resolved: '#10b981', resolvedByAI: '#a855f7', resolvedByAgents: '#0ea5e9'
}
```

**Backend endpoints** (all in `backend/src/controllers/tickets.ts`, registered before `/:id` in routes):
- `GET /api/tickets/stats` — role-branched stats. Admin returns `{ total, ongoing, resolvedByAI, resolvedByAgents, critical, openTickets[], onlineAgents[] }`. Agent returns `{ total, new, ongoing, resolvedClosed, openTickets[] }`.
- `GET /api/tickets/chart` — 30-day daily series built with `$queryRaw`. Admin: 4 series. Agent: 2 series.
- `GET /api/tickets/by-ids?ids=...` — fetch up to 10 tickets by comma-separated IDs (used by Recent Tickets).

**Critical Tickets** = `priority: 'HIGH'` (not `severity: 'CRITICAL'` — that field is sparsely populated).

**Raw SQL table name:** Prisma models without `@@map` use their capitalized name as a quoted PG identifier. Always write `FROM "Ticket"`, never `FROM ticket`.

**TicketSlideshow:** Shows 2 cards per page (`PAGE_SIZE = 2`), auto-advances every 4 s, nav controls appear only when `totalPages > 1`.

---

## Error Logging (Sentry)

**Backend:** `backend/src/instrument.ts` must be the **first import** in `index.ts` (it calls `dotenv.config()` and `Sentry.init()`). `Sentry.setupExpressErrorHandler(app)` goes after all routes, before the custom error handler. Env var: `SENTRY_DSN`.

**Frontend:** `frontend/src/instrument.ts` must be the **first import** in `main.tsx`. Needs `/// <reference types="vite/client" />` for `import.meta.env`. App wrapped in `<Sentry.ErrorBoundary>` in `main.tsx`. Env vars: `VITE_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`. Both sides no-op silently when DSN is absent.

---

## Testing Strategy

Use the right layer for each concern. The rule: **write the test at the lowest layer that can cover it.**

### Layer 1 — Component tests (unit)

Use for all UI logic. If the behavior can be verified with a mocked API and a rendered component, it belongs here — not in E2E.

**Runner:** Vitest + React Testing Library. Test files live next to the component as `<Name>.test.tsx`.

```bash
cd frontend && npm run test:component   # run once (CI)
cd frontend && npm run test:watch       # watch mode (dev)
```

Write component tests for:
- Rendering: headings, badges, table columns, empty states, error states, loading skeletons
- Conditional visibility based on role (`isAdmin`) or props
- Form/button state: disabled/enabled based on component logic
- Navigation callbacks (mock `useNavigate`, assert it was called)
- Dropdown seeding from fetched data

Do **not** write E2E tests for any of the above — unit tests are faster and sufficient.

Patterns:
- Wrap in `QueryClientProvider` with `retry: false`.
- Mock `axios` with a factory (`vi.mock('axios', () => ({ default: { get: vi.fn(), patch: vi.fn(), post: vi.fn() } }))`).
- Mock `Navbar` and any component that depends on auth context with a no-op.
- Mock `authClient.useSession` to return the desired role (`vi.mock('../lib/auth-client', () => ({ authClient: { useSession: vi.fn() } }))`).
- Mock `useParams` / `useNavigate` when the component uses router hooks directly.
- Wrap in `MemoryRouter` when the component renders `<Link>`.
- Use `findBy*` (async) when waiting for data; `getBy*` for content already in the DOM.
- When `getByText` matches both a badge `<span>` and a dropdown `<option>`, add `{ selector: 'span' }` to target only the badge.

```tsx
vi.mock('axios', () => ({ default: { get: vi.fn(), patch: vi.fn(), post: vi.fn() } }))
vi.mock('../components/Navbar', () => ({ default: () => <nav /> }))
vi.mock('../lib/auth-client', () => ({ authClient: { useSession: vi.fn() } }))

function renderWithQuery(session = adminSession) {
  vi.mocked(authClient.useSession).mockReturnValue({ data: session, isPending: false, error: null } as any)
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter><ComponentUnderTest /></MemoryRouter>
    </QueryClientProvider>
  )
}
```

> **Note:** Use `happy-dom` (already configured in `vite.config.ts`) — the latest `jsdom` requires Node >= 20.19 but this machine runs 20.15.

> **Note:** Tests that render Recharts components must stub `ResizeObserver` globally — happy-dom doesn't implement it and Recharts will crash without it:
> ```ts
> global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
> ```

### Layer 2 — E2E tests (Playwright)

Use **only** for things that cannot be tested with mocks:
- **Real API/backend** — webhook handlers, actual DB queries, backend validation
- **Cross-service pipelines** — webhook → DB → REST API → UI (the full chain)
- **Real mutations** — PATCH/POST that must hit the real server to verify the response and UI update
- **Backend-enforced authorization** — e.g. agents only seeing assigned tickets (the backend where clause, not just the frontend filter)
- **Real navigation with live data** — following a link to a URL that contains a real DB-generated ID

Do **not** write E2E tests for:
- Pure rendering (headings, badges, columns) → unit test
- Conditional visibility based on role → unit test
- Disabled/enabled button states → unit test
- Navigation tested via `mockNavigate` → unit test
- Status filter options in a dropdown → unit test

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
