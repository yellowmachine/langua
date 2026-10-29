# syntax=docker/dockerfile:1

FROM oven/bun:1.3 AS build
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .

# Module-level code (db client construction, better-auth init and its
# Seilide settings check) runs as a side effect of `vite build`
# analyzing the server module graph — it needs *some* value to not throw,
# even though nothing actually connects at build time. Real values come
# from docker-compose at runtime; these never leave this build stage.
ENV DATABASE_URL="postgres://build:build@localhost:5432/build" \
	BETTER_AUTH_SECRET="build-time-placeholder-0000000000000000" \
	BETTER_AUTH_URL="http://localhost:3000" \
	SEILIDE_URL="https://seilide.invalid" \
	SEILIDE_CLIENT_ID="build-time-placeholder" \
	SEILIDE_CLIENT_SECRET="build-time-placeholder"

RUN bun run build

FROM oven/bun:1.3-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production --ignore-scripts

COPY --from=build /app/build ./build
# For `bun run db:migrate:prod` (drizzle-orm's programmatic migrator) —
# lets the migrate service in docker-compose.prod.yml run off this same
# image instead of needing the build stage's drizzle-kit.
COPY drizzle ./drizzle
COPY scripts/migrate.ts ./scripts/migrate.ts
# scripts/link-seilide.ts, for accounts made before Seilide; run it from
# the migrate service, which has MIGRATION_DATABASE_URL. It imports the
# schema, whose only $lib import is a type (stripped by bun).
COPY scripts/link-seilide.ts ./scripts/link-seilide.ts
COPY src/lib/server/db/schema.ts ./src/lib/server/db/schema.ts

EXPOSE 3000
CMD ["bun", "build/index.js"]
