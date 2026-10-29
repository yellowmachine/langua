import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { account, user } from '../src/lib/server/db/schema';

// One-off, for accounts created before Seilide: they have a made-up
// `<username>@family.local` email, so the first «Entrar con Seilide» would
// create a new, empty account instead of linking to them. Giving each its
// Seilide email lets better-auth link it by email on that first sign-in.
// better-auth only links to a local email that is verified too: whoever
// runs this vouches for it. The old password goes too: there's no password
// sign-in any more.
//
//   bun run scripts/link-seilide.ts <username> <seilide email>
const [username, email] = process.argv.slice(2);
if (!username || !email?.includes('@')) {
	console.error('Usage: bun run scripts/link-seilide.ts <username> <seilide email>');
	process.exit(1);
}

if (!process.env.MIGRATION_DATABASE_URL) throw new Error('MIGRATION_DATABASE_URL is not set');

const client = postgres(process.env.MIGRATION_DATABASE_URL, { max: 1 });
const db = drizzle(client);

const updated = await db.transaction(async (tx) => {
	const rows = await tx
		.update(user)
		.set({ email: email.trim().toLowerCase(), emailVerified: true })
		.where(eq(user.email, `${username}@family.local`))
		.returning({ id: user.id, name: user.name });
	if (rows[0]) {
		await tx
			.delete(account)
			.where(and(eq(account.userId, rows[0].id), eq(account.providerId, 'credential')));
	}
	return rows;
});

await client.end();

if (updated.length === 0) {
	console.error(`No account with the email ${username}@family.local.`);
	process.exit(1);
}
console.log(
	`${updated[0].name}: email set to ${email}. Linked on their first sign-in with Seilide.`
);
