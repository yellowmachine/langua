import { asc, eq, getTableColumns, inArray } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import type { WithRLS } from './db/rls';
import {
	aiUsage,
	chatConversation,
	chatMessage,
	clip,
	integrationToken,
	listeningAttempt,
	speakingAttempt,
	user,
	vocabItem,
	vocabReview
} from './db/schema';

// Exportar los datos (RGPD, art. 20): todo lo de la cuenta en un JSON. Se
// filtra por user_id aunque la RLS ya lo haga, para no depender solo de ella.
// Fuera queda lo que no es del usuario sino de la app: sesiones, el hash de
// los tokens, las claves de almacenamiento, y los ejercicios de Escuchar sin
// contestar (llevan las respuestas). El audio de los clips no va: se puede
// descargar desde cada clip.

/** Sube cuando cambie la forma del fichero. */
export const EXPORT_VERSION = 1;

/** Las columnas de una tabla menos las que no se exportan. */
function columnsWithout<T extends PgTable, K extends keyof T['_']['columns']>(
	table: T,
	...omit: K[]
) {
	const columns = { ...getTableColumns(table) } as T['_']['columns'];
	for (const key of omit) delete columns[key];
	return columns as Omit<T['_']['columns'], K>;
}

/** Agrupa las filas por `key`, quitándoles esa columna (ya va en el padre). */
function groupBy<T extends Record<K, string>, K extends keyof T>(rows: T[], key: K) {
	const groups = new Map<string, Omit<T, K>[]>();
	for (const row of rows) {
		const rest: Partial<T> = { ...row };
		delete rest[key];
		const list = groups.get(row[key]) ?? [];
		list.push(rest as Omit<T, K>);
		groups.set(row[key], list);
	}
	return groups;
}

export async function getExportData(withRLS: WithRLS, userId: string) {
	return withRLS(async (tx) => {
		const [account] = await tx
			.select({
				name: user.name,
				email: user.email,
				nativeLanguage: user.nativeLanguage,
				targetLanguage: user.targetLanguage,
				voice: user.voice,
				accent: user.accent,
				theme: user.theme,
				dark: user.dark,
				highContrast: user.highContrast,
				createdAt: user.createdAt
			})
			.from(user)
			.where(eq(user.id, userId));
		if (!account) throw new Error('Account not found');

		const conversations = await tx
			.select(columnsWithout(chatConversation, 'userId'))
			.from(chatConversation)
			.where(eq(chatConversation.userId, userId))
			.orderBy(asc(chatConversation.createdAt));
		const messages = conversations.length
			? await tx
					.select(columnsWithout(chatMessage, 'id'))
					.from(chatMessage)
					.where(
						inArray(
							chatMessage.conversationId,
							conversations.map((c) => c.id)
						)
					)
					.orderBy(asc(chatMessage.createdAt))
			: [];

		const words = await tx
			.select(columnsWithout(vocabItem, 'userId'))
			.from(vocabItem)
			.where(eq(vocabItem.userId, userId))
			.orderBy(asc(vocabItem.createdAt));
		const reviews = await tx
			.select({
				vocabItemId: vocabReview.vocabItemId,
				rating: vocabReview.rating,
				reviewedAt: vocabReview.reviewedAt
			})
			.from(vocabReview)
			.where(eq(vocabReview.userId, userId))
			.orderBy(asc(vocabReview.reviewedAt));

		const clips = await tx
			.select(columnsWithout(clip, 'userId', 'audioKey'))
			.from(clip)
			.where(eq(clip.userId, userId))
			.orderBy(asc(clip.capturedAt));

		const listening = await tx
			.select(columnsWithout(listeningAttempt, 'id', 'userId'))
			.from(listeningAttempt)
			.where(eq(listeningAttempt.userId, userId))
			.orderBy(asc(listeningAttempt.createdAt));

		const speaking = await tx
			.select(columnsWithout(speakingAttempt, 'id', 'userId'))
			.from(speakingAttempt)
			.where(eq(speakingAttempt.userId, userId))
			.orderBy(asc(speakingAttempt.createdAt));

		const usage = await tx
			.select(columnsWithout(aiUsage, 'id', 'userId'))
			.from(aiUsage)
			.where(eq(aiUsage.userId, userId))
			.orderBy(asc(aiUsage.createdAt));

		const tokens = await tx
			.select({
				name: integrationToken.name,
				createdAt: integrationToken.createdAt,
				lastUsedAt: integrationToken.lastUsedAt
			})
			.from(integrationToken)
			.where(eq(integrationToken.userId, userId))
			.orderBy(asc(integrationToken.createdAt));

		const messagesByConversation = groupBy(messages, 'conversationId');
		const reviewsByWord = groupBy(reviews, 'vocabItemId');

		return {
			app: 'Langua',
			version: EXPORT_VERSION,
			exportedAt: new Date(),
			account,
			conversations: conversations.map((c) => ({
				...c,
				messages: messagesByConversation.get(c.id) ?? []
			})),
			vocabulary: words.map((w) => ({
				...w,
				reviews: reviewsByWord.get(w.id) ?? []
			})),
			clips,
			listeningAttempts: listening,
			speakingAttempts: speaking,
			aiUsage: usage,
			integrationTokens: tokens
		};
	});
}

export type ExportData = Awaited<ReturnType<typeof getExportData>>;
