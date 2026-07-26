import { relations, sql } from 'drizzle-orm';
import {
	pgTable,
	text,
	timestamp,
	boolean,
	integer,
	jsonb,
	index,
	uniqueIndex,
	pgPolicy
} from 'drizzle-orm/pg-core';
import type { HighlightError } from '$lib/textHighlight';

export type ListeningQuestionResult = {
	question: string;
	options: string[];
	correctIndex: number;
	selectedIndex: number;
};

export type ChatMessageAnalysis = {
	errors: HighlightError[];
	explanation: string | null;
};

export type VocabExample = {
	sentence: string;
	translation: string;
};

export const user = pgTable('user', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	email: text('email').notNull().unique(),
	emailVerified: boolean('email_verified').default(false).notNull(),
	image: text('image'),
	createdAt: timestamp('created_at').defaultNow().notNull(),
	updatedAt: timestamp('updated_at')
		.defaultNow()
		.$onUpdate(() => /* @__PURE__ */ new Date())
		.notNull(),
	username: text('username').unique(),
	displayUsername: text('display_username'),
	role: text('role').default('member'),
	nativeLanguage: text('native_language'),
	targetLanguage: text('target_language'),
	theme: text('theme').default('warm'),
	dark: boolean('dark').default(false),
	highContrast: boolean('high_contrast').default(false)
});

export const session = pgTable(
	'session',
	{
		id: text('id').primaryKey(),
		expiresAt: timestamp('expires_at').notNull(),
		token: text('token').notNull().unique(),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
		ipAddress: text('ip_address'),
		userAgent: text('user_agent'),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' })
	},
	(table) => [index('session_userId_idx').on(table.userId)]
);

export const account = pgTable(
	'account',
	{
		id: text('id').primaryKey(),
		accountId: text('account_id').notNull(),
		providerId: text('provider_id').notNull(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		accessToken: text('access_token'),
		refreshToken: text('refresh_token'),
		idToken: text('id_token'),
		accessTokenExpiresAt: timestamp('access_token_expires_at'),
		refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
		scope: text('scope'),
		password: text('password'),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull()
	},
	(table) => [index('account_userId_idx').on(table.userId)]
);

export const verification = pgTable(
	'verification',
	{
		id: text('id').primaryKey(),
		identifier: text('identifier').notNull(),
		value: text('value').notNull(),
		expiresAt: timestamp('expires_at').notNull(),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull()
	},
	(table) => [index('verification_identifier_idx').on(table.identifier)]
);

export const userRelations = relations(user, ({ many }) => ({
	sessions: many(session),
	accounts: many(account)
}));

export const sessionRelations = relations(session, ({ one }) => ({
	user: one(user, {
		fields: [session.userId],
		references: [user.id]
	})
}));

export const accountRelations = relations(account, ({ one }) => ({
	user: one(user, {
		fields: [account.userId],
		references: [user.id]
	})
}));

// Instance-wide settings (API keys, preferred models). One deployment =
// one family, so this is a plain key-value table, not scoped to a user.
export const appSettings = pgTable('app_settings', {
	key: text('key').primaryKey(),
	value: text('value').notNull()
});

// Per-user content: gated by Postgres RLS (see PLANNING.md §5), not just
// application code. Only reachable via `locals.withRLS`, never the plain
// `db` import — see src/hooks.server.ts.
export const chatConversation = pgTable(
	'chat_conversation',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		title: text('title'),
		targetLanguage: text('target_language'),
		createdAt: timestamp('created_at').defaultNow().notNull()
	},
	(t) => [
		index('chat_conversation_user_idx').on(t.userId),
		pgPolicy('chat_conversation_access', {
			for: 'all',
			using: sql`${t.userId} = current_setting('app.current_user_id', true)`
		})
	]
).enableRLS();

export const chatMessage = pgTable(
	'chat_message',
	{
		id: text('id').primaryKey(),
		conversationId: text('conversation_id')
			.notNull()
			.references(() => chatConversation.id, { onDelete: 'cascade' }),
		role: text('role', { enum: ['user', 'assistant'] }).notNull(),
		content: text('content').notNull(),
		analysis: jsonb('analysis').$type<ChatMessageAnalysis>(),
		createdAt: timestamp('created_at').defaultNow().notNull()
	},
	(t) => [
		index('chat_message_conversation_idx').on(t.conversationId),
		pgPolicy('chat_message_access', {
			for: 'all',
			using: sql`
				EXISTS (
					SELECT 1 FROM chat_conversation
					WHERE chat_conversation.id = ${t.conversationId}
					AND chat_conversation.user_id = current_setting('app.current_user_id', true)
				)
			`
		})
	]
).enableRLS();

export const chatConversationRelations = relations(chatConversation, ({ one, many }) => ({
	user: one(user, {
		fields: [chatConversation.userId],
		references: [user.id]
	}),
	messages: many(chatMessage)
}));

export const chatMessageRelations = relations(chatMessage, ({ one }) => ({
	conversation: one(chatConversation, {
		fields: [chatMessage.conversationId],
		references: [chatConversation.id]
	})
}));

export const listeningAttempt = pgTable(
	'listening_attempt',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		targetLanguage: text('target_language').notNull(),
		passage: text('passage').notNull(),
		questions: jsonb('questions').$type<ListeningQuestionResult[]>().notNull(),
		score: integer('score').notNull(),
		createdAt: timestamp('created_at').defaultNow().notNull()
	},
	(t) => [
		index('listening_attempt_user_idx').on(t.userId),
		pgPolicy('listening_attempt_access', {
			for: 'all',
			using: sql`${t.userId} = current_setting('app.current_user_id', true)`
		})
	]
).enableRLS();

export const listeningAttemptRelations = relations(listeningAttempt, ({ one }) => ({
	user: one(user, {
		fields: [listeningAttempt.userId],
		references: [user.id]
	})
}));

export const vocabItem = pgTable(
	'vocab_item',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		targetLanguage: text('target_language').notNull(),
		lemma: text('lemma').notNull(),
		word: text('word').notNull(),
		partOfSpeech: text('part_of_speech', {
			enum: ['noun', 'verb', 'adjective', 'adverb', 'other']
		}).notNull(),
		translation: text('translation').notNull(),
		exampleSentence: text('example_sentence').notNull(),
		extraExamples: jsonb('extra_examples').$type<VocabExample[]>().default([]).notNull(),
		tags: jsonb('tags').$type<string[]>().default([]).notNull(),
		// Kept even if the source conversation is deleted, so the study book survives it.
		sourceConversationId: text('source_conversation_id').references(() => chatConversation.id, {
			onDelete: 'set null'
		}),
		createdAt: timestamp('created_at').defaultNow().notNull()
	},
	(t) => [
		index('vocab_item_user_idx').on(t.userId),
		uniqueIndex('vocab_item_user_lang_lemma_idx').on(t.userId, t.targetLanguage, t.lemma),
		pgPolicy('vocab_item_access', {
			for: 'all',
			using: sql`${t.userId} = current_setting('app.current_user_id', true)`
		})
	]
).enableRLS();

export const vocabItemRelations = relations(vocabItem, ({ one }) => ({
	user: one(user, {
		fields: [vocabItem.userId],
		references: [user.id]
	}),
	sourceConversation: one(chatConversation, {
		fields: [vocabItem.sourceConversationId],
		references: [chatConversation.id]
	})
}));
