import { fail, redirect } from '@sveltejs/kit';
import { asc, desc, eq } from 'drizzle-orm';
import { chatConversation, chatMessage } from '$lib/server/db/schema';
import { LANGUAGES } from '$lib/languages';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const conversations = await locals.withRLS((tx) =>
		tx
			.select({
				id: chatConversation.id,
				title: chatConversation.title,
				targetLanguage: chatConversation.targetLanguage,
				createdAt: chatConversation.createdAt
			})
			.from(chatConversation)
			.orderBy(desc(chatConversation.createdAt))
	);

	const activeId = params.id ?? conversations[0]?.id ?? null;
	const activeConversation = conversations.find((c) => c.id === activeId) ?? null;

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
		activeConversation,
		messages: rows.map((row) => ({
			id: row.id,
			role: row.role,
			parts: [{ type: 'text' as const, text: row.content }]
		}))
	};
};

export const actions: Actions = {
	new: async ({ locals, request }) => {
		if (!locals.user) redirect(303, '/login');

		const data = await request.formData();
		const targetLanguage = String(data.get('targetLanguage') ?? '');
		const title = String(data.get('title') ?? '').trim();

		if (!LANGUAGES.some((lang) => lang.code === targetLanguage)) {
			return fail(400, { message: 'Elige un idioma para la conversación.' });
		}

		const id = crypto.randomUUID();
		await locals.withRLS((tx) =>
			tx.insert(chatConversation).values({
				id,
				userId: locals.user!.id,
				targetLanguage,
				title: title || null
			})
		);

		redirect(303, `/chat/${id}`);
	},

	delete: async (event) => {
		if (!event.locals.user) redirect(303, '/login');

		const data = await event.request.formData();
		const id = String(data.get('id') ?? '');
		if (!id) return fail(400, { message: 'Falta la conversación.' });

		await event.locals.withRLS((tx) =>
			tx.delete(chatConversation).where(eq(chatConversation.id, id))
		);

		if (event.params.id === id) {
			redirect(303, '/chat');
		}
	}
};
