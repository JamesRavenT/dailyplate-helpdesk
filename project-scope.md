## Problem
A company uses a standard ticketing system/helpdesk where customers send emails and human agents respond. However, it is slow and inefficient at high ticket volumes, and the use of canned responses makes customers feel unvalued.

## Solution
Integrate AI into the system to classify issues by category, priority, and severity. If a ticket falls into an easily resolvable category (e.g., general "how to" or "when" queries), the AI sends an immediate, human-friendly response using a knowledge base. If the issue is technical or sensitive (e.g., "I can't login", "I want a refund"), it is routed to a human agent instead. If a customer replies back unsatisfied with an AI response, an agent can take over the ticket. Agents also have an AI reply assistant built into their response textbox — a button they can click to generate or enhance their draft before sending.

## Project Context
Single-company internal helpdesk tool. Built as a portfolio MVP to demonstrate to potential employers/clients. Email infrastructure should use free, easy-to-integrate services.

---

## AI Resolution Logic
- **Auto-resolve** — General queries ("how to", "when", FAQ-type questions): AI responds immediately using the knowledge base. No human approval; responses go out instantly.
- **Human-route** — Technical or sensitive issues ("can't login", "I want a refund", billing, account access): ticket is assigned to a human agent.
- If a customer replies unsatisfied with an AI response, an agent can take over the ticket thread at any point.

## Knowledge Base
- FAQ content is stored as markdown files.
- Admin manages these files through the dashboard (upload/edit/delete).
- The AI uses this content to generate auto-responses for general query tickets.

## Email Handling
- Incoming customer emails automatically create tickets.
- The system replies within the same email thread so full conversation history is preserved.
- Both AI auto-responses and agent replies are sent from within that same thread.

## Ticket Assignment
- When a ticket is routed to a human agent, the system automatically assigns it using **round-robin** (simplest for MVP; can be upgraded to least-busy later).

## User Roles
- **Admin** — Full access: manages agents, views all tickets and dashboard, manages knowledge base files, configures system settings.
- **Agent** — Manages their assigned ticket queue, responds to customers, uses AI reply assistant.
- Login via a dedicated URL (e.g., `/agent-login/`).

## Agent Notifications
New ticket assignments appear in the agent's interface with the format:
`[Category] Subject line` — e.g., `[Technical] I can't seem to access my account`

## Ticket Metadata
Each ticket displays three layers of metadata:

`Status` — `Category` — `Tags`

- **Status**:
  - *Open* — newly created, not yet being handled
  - *In Progress* — assigned to and being worked on by an agent
  - *Resolved* — marked done by the agent
  - *Closed* — customer confirmed resolution, or auto-closed after 7 days of no reply (configurable by Admin)
  - If a customer replies to a Resolved or Closed ticket thread, the ticket is automatically reopened (back to Open)
- **Category**: AI-classified type of issue (e.g., General Query, Technical, Billing, Refund)
- **Tags**: Priority (Low / Medium / High) and Severity (Minor / Major / Critical) — set by AI on all tickets at classification time

---

## Features
- Receive support emails and create tickets automatically
- AI-powered ticket classification (category, priority, severity)
- Auto-resolution for general query tickets via AI + knowledge base
- Routing of complex/technical tickets to human agents via round-robin
- Agent takeover for tickets where the customer is unsatisfied with the AI response
- Ticket list with filtering and sorting
- Ticket detailed view with full email thread history
- AI-generated per-ticket summaries for agents to quickly understand context
- AI reply assistant — agent clicks a button in the response textbox to generate or enhance their draft
- In-app agent notifications for newly assigned tickets
- Dashboard to view and manage all tickets
- Knowledge base management (Admin — upload/edit/delete FAQ markdown files)
- User management (Admin only)
