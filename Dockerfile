# syntax=docker/dockerfile:1

FROM oven/bun:1 AS build
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .

# Module-level code (db client construction, better-auth init, the
# encryption key length check) runs as a side effect of `vite build`
# analyzing the server module graph — it needs *some* value to not throw,
# even though nothing actually connects at build time. Real values come
# from docker-compose at runtime; these never leave this build stage.
ENV DATABASE_URL="postgres://build:build@localhost:5432/build" \
	BETTER_AUTH_SECRET="build-time-placeholder-0000000000000000" \
	BETTER_AUTH_URL="http://localhost:3000" \
	ENCRYPTION_KEY="AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="

RUN bun run build

FROM oven/bun:1-slim AS runtime
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

EXPOSE 3000
CMD ["bun", "build/index.js"]
