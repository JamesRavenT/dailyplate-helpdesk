# Get started with DailyPlate Helpdesk

This tutorial runs the full application locally, loads demo data, and walks through one support
ticket. The core track needs no OpenAI, Resend, or other API key.

## What you need

- Bun 1.x
- Node.js 20.x
- Docker Desktop
- Git

## Core track: work a seeded ticket without API keys

### 1. Clone and install

Replace the example repository URL with the URL you want to clone:

```bash
git clone https://github.com/your-account/dailyplate-helpdesk.git
cd dailyplate-helpdesk

cd backend
bun install
cd ../frontend
npm install
cd ..
```

### 2. Create the local backend configuration

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` before starting Docker:

```dotenv
DATABASE_URL=postgresql://helpdesk:helpdesk@localhost:5433/helpdesk
DATABASE_URL_UNPOOLED=postgresql://helpdesk:helpdesk@localhost:5433/helpdesk
BETTER_AUTH_SECRET=replace-with-at-least-32-random-characters
BETTER_AUTH_URL=http://localhost:3001
FRONTEND_URL=http://localhost:5173
SEED_ADMIN_EMAIL=admin@example.com
SEED_ADMIN_PASSWORD=choose-a-password-of-at-least-8-characters
WEBHOOK_SECRET=choose-a-local-webhook-secret
```

Leave `AI_PROVIDER=openai` in place. The core lesson does not ingest or process a new ticket and
does not use the Polish or Summarize actions, so no OpenAI call is made. The placeholder
`OPENAI_API_KEY` and `RESEND_API_KEY` values are not used in this track. `AI_PROVIDER=stub` is a
test-suite facility, not a user-facing offline mode for this tutorial.

### 3. Start PostgreSQL, migrate, and seed

The Compose file reads `backend/.env` while loading, even when only PostgreSQL is selected.

```bash
docker compose up postgres -d

cd backend
bun run prisma:deploy
bun run prisma:seed
cd ..
```

The seed creates the admin account from `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` and loads
the knowledge base.

### 4. Run both apps

Keep these commands running in separate terminals:

```bash
# terminal 1
cd backend
bun run dev
```

```bash
# terminal 2
cd frontend
npm run dev
```

Open `http://localhost:5173/login` and sign in with the seeded admin credentials.

### 5. Create an agent and load demo tickets

The demo-ticket seed requires at least one active agent:

1. Open **Users**.
2. Choose **Create user** and create an agent account with a password of at least eight
   characters.
3. In another terminal, run:

   ```bash
   cd backend
   bun run seed:tickets
   ```

`seed:tickets` replaces all existing ticket and message data with the demo dataset. Refresh the
browser after it finishes.

### 6. Work a ticket

1. Open **Tickets** to view the seeded queue.
2. Choose an unassigned `OPEN` ticket.
3. Assign it to the agent you created.
4. Open the ticket and change its status to `IN_PROGRESS`.
5. Write a reply in the composer and post it.
6. Change the status to `RESOLVED` when the issue is complete.

Because `NODE_ENV` is not `production`, the reply is stored in the conversation but outbound
email is skipped. Resend is therefore not required for local work.

## Optional AI track: ingest and triage a new ticket

> This track requires a real `OPENAI_API_KEY` and makes a **paid OpenAI API call**. Do not
> continue if you do not intend to incur API usage.

1. Put a real `OPENAI_API_KEY` in `backend/.env`, keep `AI_PROVIDER=openai`, and restart the
   backend so it loads the new value.
2. Send a policy-only question through the development-only legacy webhook. Replace
   `choose-a-local-webhook-secret` if you chose a different `WEBHOOK_SECRET`:

   ```bash
   curl --request POST http://localhost:3001/api/webhooks/inbound-email \
     --header "Content-Type: application/json" \
     --header "X-Webhook-Secret: choose-a-local-webhook-secret" \
     --data '{"from_email":"learner@example.com","from_name":"Taylor","subject":"How do vouchers work?","body":"Where do I enter a voucher code at checkout?","message_id":"<tutorial-001@example.com>"}'
   ```

3. Watch the backend terminal. The pg-boss worker classifies the ticket and may auto-resolve
   this policy-only question. If the model decides human help is needed, the ticket becomes
   `OPEN` and is assigned only if an agent is currently `ONLINE`.
4. Refresh **Tickets** after processing finishes and inspect the result.

Newly ingested tickets start as `AI_PROCESSING`, and admin ticket-list queries deliberately hide
that status. If the API key is missing or invalid, processing can fail and the ticket may remain
hidden in `AI_PROCESSING`; that does not mean ingestion failed. Check the backend logs before
retrying. Outbound Resend sending is still skipped outside production.
