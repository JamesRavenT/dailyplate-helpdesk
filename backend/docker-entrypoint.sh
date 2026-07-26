#!/bin/sh
set -e

bun run prisma:deploy
bun run prisma:seed || echo '[seed] skipped/failed'
exec bun src/index.ts
