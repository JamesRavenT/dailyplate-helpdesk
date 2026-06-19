## Implementation Plan

Monorepo structure: `/frontend` (React) and `/backend` (Express) in one repository.

---

## Phase 1 — Project Setup

**1.1 Monorepo Scaffold**
- [ ] Create root directory with `/frontend` and `/backend` folders
- [ ] Initialize `git` repository and add `.gitignore`
- [ ] Add root `README.md` with project overview and local setup instructions

**1.2 Backend Scaffold**
- [ ] Initialize Node.js project with TypeScript (`tsconfig.json`)
- [ ] Install Express, `ts-node`, `nodemon`
- [ ] Set up folder structure: `/routes`, `/controllers`, `/services`, `/middleware`, `/prisma`
- [ ] Create `.env.example` with all required environment variable keys

**1.3 Frontend Scaffold**
- [ ] Initialize React + TypeScript project with Vite
- [ ] Install and configure Tailwind CSS
- [ ] Install React Router v6
- [ ] Set up folder structure: `/pages`, `/components`, `/hooks`, `/services`, `/context`

**1.4 Docker Setup**
- [ ] Write `Dockerfile` for backend (Node.js)
- [ ] Write `Dockerfile` for frontend (Vite build → Nginx serve)
- [ ] Write `docker-compose.yml` for local dev (PostgreSQL + backend + frontend)
- [ ] Verify `docker-compose up` runs all three services cleanly

---

## Phase 2 — Database Schema

**2.1 Prisma Setup**
- [ ] Install Prisma, initialize with PostgreSQL provider
- [ ] Connect to local PostgreSQL via `docker-compose`

**2.2 Define Schema**
- [ ] `User` — id, name, email, password_hash, role (ADMIN | AGENT), is_active, created_at
- [ ] `Session` — for `connect-pg-simple` (auto-managed)
- [ ] `Ticket` — id, subject, customer_name, customer_email, status, category, priority, severity, assigned_to (User FK), email_thread_id, is_ai_handled, last_customer_reply_at, created_at, updated_at
- [ ] `Message` — id, ticket_id (FK), body, sender_type (CUSTOMER | AGENT | AI), sent_at
- [ ] `KnowledgeBaseFile` — id, filename, content (markdown text), created_at, updated_at
- [ ] `SystemConfig` — key (string, unique), value (string) — stores settings like `auto_close_days`
- [ ] `RoundRobinState` — tracks which agent was last assigned (single-row table)

**2.3 Migrate & Seed**
- [ ] Run initial Prisma migration
- [ ] Write seed script: one Admin user, two Agent users, default SystemConfig (`auto_close_days = 7`)

---

## Phase 3 — Authentication

**3.1 Backend**
- [ ] Install `express-session`, `connect-pg-simple`, `bcrypt`
- [ ] Configure session middleware (httpOnly cookie, PostgreSQL store)
- [ ] `POST /auth/login` — validate email + password, create session
- [ ] `POST /auth/logout` — destroy session
- [ ] `GET /auth/me` — return current session user (role, name, id)
- [ ] `requireAuth` middleware — rejects unauthenticated requests
- [ ] `requireAdmin` middleware — rejects non-admin users

**3.2 Frontend**
- [ ] `AuthContext` — stores current user, exposes login/logout functions
- [ ] Login page at `/agent-login` (email + password form)
- [ ] `ProtectedRoute` component — redirects to `/agent-login` if not authenticated
- [ ] Post-login redirect: Admin → `/admin/dashboard`, Agent → `/agent/dashboard`
- [ ] Logout button that calls `POST /auth/logout` and clears context

---

## Phase 4 — Email Infrastructure

**4.1 Resend Setup**
- [ ] Create Resend account, verify sending domain
- [ ] Configure Resend Inbound (set webhook URL pointing to backend)
- [ ] Install Resend SDK in backend

**4.2 Inbound Email Handling**
- [ ] `POST /webhooks/inbound` — receive and parse Resend Inbound webhook payload
- [ ] Extract: sender email, sender name, subject, body, `Message-ID`, `In-Reply-To` headers
- [ ] Logic: if `In-Reply-To` matches an existing ticket's `email_thread_id`, append as a new Message; otherwise create a new Ticket
- [ ] If customer replies to a Resolved or Closed ticket, reopen it (status → Open)
- [ ] Webhook signature verification for security

**4.3 Outbound Email**
- [ ] `sendReply(ticketId, body)` service — sends via Resend, sets `In-Reply-To` and `References` headers to maintain thread
- [ ] Test full round-trip: inbound email → ticket created → reply sent → appears in same thread

---

## Phase 5 — AI Integration

**5.1 OpenAI Setup**
- [ ] Install OpenAI SDK, configure API key via environment variable
- [ ] Create `ai.service.ts` as the single module for all AI calls

**5.2 Ticket Classification**
- [ ] `classifyTicket(subject, body)` — returns `{ category, priority, severity, shouldAutoResolve: boolean }`
- [ ] Categories: General Query, Technical, Billing, Refund, Account Access, Other
- [ ] Priority: Low, Medium, High
- [ ] Severity: Minor, Major, Critical
- [ ] `shouldAutoResolve: true` for General Query only

**5.3 Auto-Response Generation**
- [ ] `generateAutoResponse(ticketBody, knowledgeBaseContent)` — returns a human-friendly reply
- [ ] Knowledge base loader: fetch all `KnowledgeBaseFile` records and concatenate content for the prompt

**5.4 Ticket Summary**
- [ ] `generateSummary(messages[])` — returns a short summary of the full thread for the agent

**5.5 Reply Enhancement**
- [ ] `enhanceReply(agentDraft, ticketContext)` — improves tone, grammar, and clarity of the agent's draft

---

## Phase 6 — Core Ticket Logic

**6.1 Ticket Routing Pipeline**
- [ ] On new ticket created (from inbound webhook): call `classifyTicket`
- [ ] Save category, priority, severity to ticket
- [ ] If `shouldAutoResolve`: call `generateAutoResponse` → send via Resend → mark ticket `is_ai_handled = true`, status = Resolved
- [ ] If not `shouldAutoResolve`: call round-robin assignment → assign ticket to agent → status = Open

**6.2 Round-Robin Assignment**
- [ ] `assignNextAgent()` service — queries all active agents, reads `RoundRobinState`, picks next agent, updates state
- [ ] Skips inactive/deactivated agents

**6.3 Auto-Close Cron Job**
- [ ] Install `node-cron`
- [ ] Daily job: find all Resolved tickets where `last_customer_reply_at` (or `updated_at`) is older than `auto_close_days` config value → set status to Closed

**6.4 Agent Takeover**
- [ ] `PATCH /tickets/:id/takeover` — sets `is_ai_handled = false`, assigns to requesting agent, status → In Progress

---

## Phase 7 — Ticket API Endpoints

**7.1 Ticket CRUD**
- [ ] `GET /tickets` — list tickets; query params: `status`, `category`, `priority`, `assigned_to`, `sort`
  - Agents see only their assigned tickets
  - Admins see all tickets
- [ ] `GET /tickets/:id` — full ticket detail with all Messages

**7.2 Ticket Actions**
- [ ] `PATCH /tickets/:id/status` — update status (Resolved, Closed, Open)
- [ ] `POST /tickets/:id/reply` — agent sends reply; saves Message, sends via Resend, sets status → In Progress
- [ ] `POST /tickets/:id/takeover` — agent takes over an AI-handled ticket
- [ ] `POST /tickets/:id/summary` — calls `generateSummary`, returns text (not persisted)
- [ ] `POST /tickets/:id/enhance-reply` — calls `enhanceReply` with agent draft, returns enhanced text

---

## Phase 8 — Agent Interface

**8.1 Layout**
- [ ] Sidebar navigation (Ticket Queue, Notifications)
- [ ] Top bar (agent name, logout)
- [ ] Responsive main content area

**8.2 Ticket Queue Page**
- [ ] List of assigned tickets with status/category/tag badges
- [ ] Format: `[Category] Subject` as the ticket header
- [ ] Filter bar: by status, category, priority
- [ ] Sort: newest, oldest, priority

**8.3 Ticket Detail Page**
- [ ] Metadata bar: Status — Category — Priority / Severity tags
- [ ] AI Summary panel (button to generate on demand)
- [ ] Full message thread (customer messages, agent replies, AI replies — visually differentiated)
- [ ] "Take Over" button (visible only on AI-handled tickets)
- [ ] Response textbox with "Enhance with AI" button
- [ ] Send Reply button
- [ ] "Mark as Resolved" button

**8.4 In-App Notifications (SSE)**
- [ ] Backend: `GET /sse/notifications` — streams new ticket assignment events to the agent
- [ ] Backend: emit event when a ticket is assigned to an agent
- [ ] Frontend: `useSSE` hook — connects on login, listens for events
- [ ] Notification indicator in sidebar (badge count)
- [ ] Notification dropdown: shows `[Category] Subject` for each new ticket

---

## Phase 9 — Admin Interface

**9.1 Dashboard**
- [ ] Stats cards: Total Tickets, Open, In Progress, Resolved, Closed
- [ ] Recent tickets table (all tickets, not filtered by agent)

**9.2 All Tickets View**
- [ ] Same ticket list as agent view but shows all tickets across all agents
- [ ] Additional column: Assigned Agent
- [ ] Admin can manually reassign a ticket to a different agent

**9.3 User Management**
- [ ] List all agents (name, email, status active/inactive)
- [ ] Create new agent (name, email, password)
- [ ] Edit agent (name, email, reset password)
- [ ] Deactivate agent (excluded from round-robin, cannot log in)

**9.4 Knowledge Base Management**
- [ ] List all FAQ markdown files (filename, last updated)
- [ ] Upload new file (filename + markdown content textarea)
- [ ] Edit existing file content
- [ ] Delete file

**9.5 System Settings**
- [ ] Auto-close days field (reads/writes `SystemConfig` key `auto_close_days`)
- [ ] Save button with confirmation

---

## Phase 10 — Deployment

**10.1 Production Docker**
- [ ] Finalize backend `Dockerfile` (build TS, run compiled JS)
- [ ] Finalize frontend `Dockerfile` (Vite build → Nginx, configure API proxy)
- [ ] Write production `docker-compose.yml` (or separate service configs for Railway)

**10.2 Railway Deploy**
- [ ] Create Railway project
- [ ] Add PostgreSQL plugin
- [ ] Set all environment variables (OpenAI key, Resend key, session secret, DB URL)
- [ ] Deploy backend and frontend services
- [ ] Point Resend Inbound webhook to production backend URL

**10.3 Smoke Test**
- [ ] Send a test email → ticket created
- [ ] General query → AI auto-responds
- [ ] Technical query → assigned to agent
- [ ] Agent logs in, sees ticket, replies
- [ ] Customer replies back → message appended to thread
- [ ] Agent marks resolved → auto-closes after 7 days

---

## Build Order Summary

```
Phase 1  →  Phase 2  →  Phase 3  →  Phase 4
                                        ↓
Phase 6  ←  Phase 5  ←────────────────┘
   ↓
Phase 7  →  Phase 8  →  Phase 9  →  Phase 10
```

Phases 1–4 are purely foundational. Phase 5 (AI) depends on Phase 4 (email/tickets exist to classify). Phase 6 wires them together. Phases 8 and 9 (UI) can begin in parallel with Phase 7 once Phase 3 (auth) is done.
