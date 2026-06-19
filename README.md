# Helpdesk — AI-Powered Ticketing System

A full-stack helpdesk application that integrates AI to classify, auto-respond to, and route customer support tickets.

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS + React Router v6 |
| Backend | Express.js + TypeScript running on Bun |
| Database | PostgreSQL via Prisma ORM |
| Auth | Database sessions (express-session + connect-pg-simple) |
| AI | OpenAI GPT-4o-mini |
| Email | Resend (inbound + outbound) |
| Dev | Docker Compose |

## Local Setup

### Prerequisites

- [Bun](https://bun.sh) v1.x
- [Docker Desktop](https://www.docker.com/products/docker-desktop)

### 1. Clone and install

```bash
git clone <repo-url>
cd helpdesk

# Install backend deps
cd backend && bun install && cd ..

# Install frontend deps
cd frontend && bun install && cd ..
```

### 2. Configure environment

```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your API keys
```

### 3. Start with Docker

```bash
docker-compose up
```

This starts:
- PostgreSQL on `localhost:5432`
- Backend API on `http://localhost:3001`
- Frontend dev server on `http://localhost:5173`

### 4. Run database migrations (after first `docker-compose up`)

```bash
cd backend && bunx prisma migrate dev
```

## Project Structure

```
helpdesk/
├── backend/                 # Express API
│   ├── src/
│   │   ├── index.ts         # App entry point
│   │   ├── routes/          # Route definitions
│   │   ├── controllers/     # Request handlers
│   │   ├── services/        # Business logic
│   │   └── middleware/      # Auth, error handling
│   └── prisma/              # Schema + migrations
├── frontend/                # React SPA
│   └── src/
│       ├── pages/           # Route-level components
│       ├── components/      # Reusable UI components
│       ├── hooks/           # Custom React hooks
│       ├── services/        # API client functions
│       └── context/         # React context providers
└── docker-compose.yml
```

## User Roles

- **Admin** — manages agents, knowledge base, system settings, views all tickets
- **Agent** — manages assigned ticket queue, replies to customers, uses AI assistant

Login at `/agent-login`.

## Ticket Lifecycle

```
New email → AI classification → General Query? → AI auto-response → Resolved
                                              ↘ Technical/Billing/etc → Assigned to agent (round-robin) → In Progress → Resolved → Closed
```
