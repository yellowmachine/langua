import { redirect } from '@sveltejs/kit';
import { asc, desc, eq } from 'drizzle-orm';
import { chatConversation, chatMessage } from '$lib/server/db/schema';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const conversations = await locals.withRLS((tx) =>
		tx
			.select({
				id: chatConversation.id,
				title: chatConversation.title,
				createdAt: chatConversation.createdAt
			})
			.from(chatConversation)
			.orderBy(desc(chatConversation.createdAt))
	);

	const activeId = params.id ?? conversations[0]?.id ?? null;

	const rows = activeId
		? await locals.withRLS((tx) =>
				tx
					.select({ id: chatMessage.id, role: chatMessage.role, content: chatMessage.content })
					.from(chatMessage)
					.where(eq(chatMessage.conversationId, activeId))
					.orderBy(asc(chatMessage.createdAt))
			)
		: [];

	return {
		conversations,
		activeId,
		messages: rows.map((row) => ({
			id: row.id,
			role: row.role,
			parts: [{ type: 'text' as const, text: row.content }]
		}))
	};
};

export const actions: Actions = {
	new: async ({ locals }) => {
		if (!locals.user) redirect(303, '/login');

		const id = crypto.randomUUID();
		await locals.withRLS((tx) =>
			tx.insert(chatConversation).values({
				id,
				userId: locals.user!.id,
				targetLanguage: locals.user!.targetLanguage
			})
		);

		redirect(303, `/chat/${id}`);
	}
};
