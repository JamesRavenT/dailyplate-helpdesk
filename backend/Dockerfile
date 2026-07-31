FROM oven/bun:1.3.14

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .

RUN DATABASE_URL=postgresql://helpdesk:helpdesk@postgres:5432/helpdesk \
    DATABASE_URL_UNPOOLED=postgresql://helpdesk:helpdesk@postgres:5432/helpdesk \
    bun run prisma:generate

EXPOSE 3001

CMD ["bun", "run", "dev"]
