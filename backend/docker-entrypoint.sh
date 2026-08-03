#!/bin/sh
set -e

bun run prisma:deploy
exec bun src/index.ts
