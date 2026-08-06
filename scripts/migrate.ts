import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

// Runs migrations with drizzle-orm's programmatic migrator instead of the
// drizzle-kit CLI, so this only needs the `drizzle-orm`/`postgres` runtime
// deps and the drizzle/ SQL files — not drizzle-kit and the rest of the
// build stage's dev tooling. Lets the `migrate` service in
// docker-compose.prod.yml run off the same slim image published to GHCR
// instead of building from source.
if (!process.env.MIGRATION_DATABASE_URL) throw new Error('MIGRATION_DATABASE_URL is not set');

const client = postgres(process.env.MIGRATION_DATABASE_URL, { max: 1 });

await migrate(drizzle(client), { migrationsFolder: './drizzle' });
await client.end();
