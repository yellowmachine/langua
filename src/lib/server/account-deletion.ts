import { count, eq } from 'drizzle-orm';
import type { WithRLS } from './db/rls';
import { chatConversation, clip, user, vocabItem } from './db/schema';
import type { ObjectStorage } from './storage/types';

// Borrar la cuenta. Todo lo de cada usuario cuelga de `user` con ON DELETE
// CASCADE (conversaciones, vocabulario, repasos, clips, intentos, tokens,
// gasto en IA, sesiones…), así que basta con borrar la fila. Lo único fuera
// de la base de datos es el audio de los clips, que se borra después.
//
// La cuenta de Seilide no se toca: si vuelve a entrar, empieza con una nueva.

/** Cuánto vale una sesión para borrar la cuenta sin volver a entrar. */
export const RECENT_SESSION_MS = 15 * 60 * 1000;

export function isRecentSession(sessionCreatedAt: Date, now = Date.now()): boolean {
	return now - new Date(sessionCreatedAt).getTime() < RECENT_SESSION_MS;
}

export type DeletionPreview = { conversations: number; words: number; clips: number };

/** Lo que se pierde, para enseñarlo antes de confirmar. */
export function getDeletionPreview(withRLS: WithRLS): Promise<DeletionPreview> {
	return withRLS(async (tx) => {
		const [[conversations], [words], [clips]] = await Promise.all([
			tx.select({ n: count() }).from(chatConversation),
			tx.select({ n: count() }).from(vocabItem),
			tx.select({ n: count() }).from(clip)
		]);
		return { conversations: conversations.n, words: words.n, clips: clips.n };
	});
}

/** Borra la cuenta y todo lo suyo; luego, el audio de sus clips. */
export async function deleteAccount(
	withRLS: WithRLS,
	storage: ObjectStorage,
	userId: string
): Promise<void> {
	const audioKeys = await withRLS(async (tx) => {
		const clips = await tx.select({ audioKey: clip.audioKey }).from(clip);
		const deleted = await tx.delete(user).where(eq(user.id, userId)).returning({ id: user.id });
		if (deleted.length === 0) throw new Error('Account not found');
		return clips.map((c) => c.audioKey);
	});

	// Después de la fila (como al borrar un clip): si algo falla queda un
	// fichero huérfano, nunca una cuenta a medio borrar.
	for (const key of audioKeys) {
		await storage
			.delete(key)
			.catch((err) => console.error(`[account] deleting clip audio ${key} failed:`, err));
	}
}
