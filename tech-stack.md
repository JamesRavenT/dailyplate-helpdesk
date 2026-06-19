## Tech Stack

### Architecture
Separate frontend and backend — React SPA served independently, communicating with a Node.js REST API. Both containerized via Docker.

---

### Frontend
| | |
|---|---|
| **Framework** | React 18 + TypeScript |
| **Routing** | React Router v6 |
| **Styling** | Tailwind CSS |
| **HTTP Client** | Axios or native Fetch |
| **Real-time** | Server-Sent Events (SSE) for in-app agent notifications |

### Backend
| | |
|---|---|
| **Runtime** | Node.js |
| **Framework** | Express.js + TypeScript |
| **Authentication** | Database sessions via `express-session` + `connect-pg-simple` (sessions stored in PostgreSQL) |
| **ORM** | Prisma |
| **Database** | PostgreSQL |

### Services
| | |
|---|---|
| **AI** | OpenAI API (GPT-4o-mini for classification + response generation) |
| **Email Sending** | Resend |
| **Email Receiving** | Resend Inbound (webhook → backend API route) |

### Deployment
| | |
|---|---|
| **Containerization** | Docker (Dockerfile per service + `docker-compose.yml` for local dev) |
| **Cloud Provider** | Railway *(recommended — easiest for portfolio, supports Docker, has a free tier)* / Fly.io / AWS |

---

## Notes

- **Monorepo structure** — keep `/frontend` and `/backend` in one repository for simplicity.
- **Session auth flow** — agent logs in via `/agent-login`, backend creates a session row in PostgreSQL, session ID stored in an httpOnly cookie. No JWTs.
- **Inbound email flow** — Resend Inbound receives the customer email and POSTs a webhook payload to the backend, which parses it and creates/updates the ticket.
- **OpenAI usage** — GPT-4o-mini handles classification (category, priority, severity) and auto-response generation cheaply. GPT-4o can be swapped in for better quality if needed.
- **Docker Compose** — local dev runs PostgreSQL, frontend, and backend as containers so setup is one command (`docker-compose up`).
