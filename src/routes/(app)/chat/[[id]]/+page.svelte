<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import Chip from '$lib/components/ui/Chip.svelte';
	import Switch from '$lib/components/ui/Switch.svelte';
	import BookOpen from '@lucide/svelte/icons/book-open';
	import Languages from '@lucide/svelte/icons/languages';
	import MessagesSquare from '@lucide/svelte/icons/messages-square';
	import Plus from '@lucide/svelte/icons/plus';
	import SendHorizontal from '@lucide/svelte/icons/send-horizontal';
	import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal';
	import { announcer } from '$lib/announcer.svelte';
	import { Chat } from '@ai-sdk/svelte';
	import { DefaultChatTransport } from 'ai';
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { afterNavigate, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import SpeakButton from '$lib/components/SpeakButton.svelte';
	import WordPanel, { type WordLookup } from '$lib/components/WordPanel.svelte';
	import RecordButton from '$lib/components/RecordButton.svelte';
	import { fetchSpeechAudio } from '$lib/audio';
	import { drawer } from '$lib/drawer';
	import { rovingFocus } from '$lib/rovingFocus';
	import { LANGUAGES } from '$lib/languages';
	import { LEVELS } from '$lib/levels';
	import { CONVERSATION_TEMPLATES } from '$lib/conversationTemplates';
	import { buildHighlightSegments, type HighlightError } from '$lib/textHighlight';
	import { splitIntoWords, sentenceContaining } from '$lib/wordTokens';
	import type { ActionData, PageData } from './$types';

	interface MessageAnalysis {
		errors: HighlightError[];
		explanation: string | null;
	}

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let autoPlay = $state(
		typeof localStorage !== 'undefined'
			? localStorage.getItem('langua-chat-autoplay') !== '0'
			: true
	);

	function toggleAutoPlay() {
		autoPlay = !autoPlay;
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem('langua-chat-autoplay', autoPlay ? '1' : '0');
		}
	}

	let quickReplies = $state(
		typeof localStorage !== 'undefined'
			? localStorage.getItem('langua-chat-quickreplies') === '1'
			: false
	);

	function toggleQuickReplies() {
		quickReplies = !quickReplies;
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem('langua-chat-quickreplies', quickReplies ? '1' : '0');
		}
	}

	let conversationsOpen = $state(false);
	// Phones: the chat options are folded away behind a button.
	let settingsOpen = $state(false);
	let wordPanelOpen = $state(false);

	// One Chat per conversation: rebuilt only when the conversation changes,
	// not on every invalidate (deleting another conversation, say), which
	// would drop a reply that is still streaming in.
	let chat = $derived.by(() => {
		const id = data.activeId ?? undefined;
		return untrack(() => createChat(id));
	});

	function createChat(id: string | undefined) {
		return new Chat({
			id,
			messages: data.messages,
			transport: new DefaultChatTransport({ api: resolve('/chat/api') }),
			onFinish: ({ message, isAbort, isError }) => {
				if (isAbort || isError) return;
				const text = message.parts
					.filter((part) => part.type === 'text')
					.map((part) => part.text)
					.join('');
				if (!text) return;
				announcer.say(`Tutor: ${text}`);
				if (autoPlay) {
					// play() is refused without a recent click (autoplay policy):
					// the speaker button is still there.
					fetchSpeechAudio(text, data.activeConversation?.targetLanguage)
						.then((audio) => audio?.play())
						.catch(() => {});
				}
				if (quickReplies) {
					fetchSuggestions(message.id, text);
				}
			}
		});
	}

	// What belongs to the conversation on screen starts over with another one.
	afterNavigate(({ from, to }) => {
		if (from?.params?.id === to?.params?.id) return;
		vocabExtraction = 'idle';
		wordLookup = 'idle';
		wordPanelOpen = false;
		expandedTranslation = {};
		sessionSuggestions = {};
		lastSent = '';
		input = '';
	});

	let input = $state('');
	let busy = $derived(chat.status === 'streaming' || chat.status === 'submitted');
	let newDialog: HTMLDialogElement | undefined = $state();
	let newTitle = $state('');

	let startingConversation = false;
	// Conversation whose opening message failed: don't retry it on every
	// effect run, only when the learner asks to.
	let startFailedFor: string | null = $state(null);

	function startConversation(conversationId: string) {
		startingConversation = true;
		startFailedFor = null;
		fetch('/chat/start', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ conversationId })
		})
			.then((response) => {
				if (!response.ok) throw new Error(String(response.status));
				return invalidateAll();
			})
			.then(() => {
				// The Chat outlives invalidations: give it the opening message.
				if (data.activeId === conversationId && chat.messages.length === 0) {
					chat.messages = data.messages;
				}
			})
			.catch(() => {
				startFailedFor = conversationId;
				announcer.alert('No se pudo empezar la conversación.');
			})
			.finally(() => {
				startingConversation = false;
			});
	}

	$effect(() => {
		if (!data.activeId || data.messages.length > 0 || startingConversation) return;
		if (startFailedFor === data.activeId) return;
		startConversation(data.activeId);
	});

	// Last text the learner sent, to put back in the input if the reply fails.
	let lastSent = $state('');

	$effect(() => {
		if (chat.error) announcer.alert('El tutor no ha podido responder.');
	});

	function retryReply() {
		chat.clearError();
		chat.regenerate();
	}

	let sessionAnalysis: Record<string, MessageAnalysis | 'loading'> = $state({});
	let analysisByMessageId = $derived({ ...data.analysisByMessageId, ...sessionAnalysis });

	let sessionTranslation: Record<string, string | 'loading'> = $state({});
	let translationByMessageId = $derived({ ...data.translationByMessageId, ...sessionTranslation });
	let expandedTranslation: Record<string, boolean> = $state({});

	async function toggleTranslation(messageId: string, text: string) {
		expandedTranslation[messageId] = !expandedTranslation[messageId];
		if (!expandedTranslation[messageId]) return;

		const existing = translationByMessageId[messageId];
		if (existing && existing !== 'loading') return;

		const language = data.activeConversation?.targetLanguage;
		if (!language || !data.activeId) return;

		sessionTranslation[messageId] = 'loading';
		try {
			const response = await fetch('/chat/translate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ messageId, conversationId: data.activeId, text, language })
			});
			if (!response.ok) {
				delete sessionTranslation[messageId];
				return;
			}
			const result: { translation: string } = await response.json();
			sessionTranslation[messageId] = result.translation;
			announcer.say(`Traducción: ${result.translation}`);
		} catch {
			delete sessionTranslation[messageId];
		}
	}

	let vocabExtraction: 'idle' | 'loading' | { added: number } | 'error' = $state('idle');

	async function extractVocabulary() {
		if (!data.activeId || vocabExtraction === 'loading') return;

		vocabExtraction = 'loading';
		try {
			const response = await fetch('/chat/vocabulary', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ conversationId: data.activeId })
			});
			if (!response.ok) {
				vocabExtraction = 'error';
				announcer.alert('No se pudo extraer el vocabulario.');
				return;
			}
			const result: { added: number } = await response.json();
			vocabExtraction = { added: result.added };
			announcer.say(
				result.added > 0
					? `${result.added} palabras nuevas en el libro de estudio`
					: 'Sin palabras nuevas'
			);
		} catch {
			vocabExtraction = 'error';
		}
	}

	async function analyzeMessage(messageId: string, conversationId: string, text: string) {
		const language = data.activeConversation?.targetLanguage;
		if (!language) return;

		sessionAnalysis[messageId] = 'loading';
		try {
			const response = await fetch('/chat/analyze', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ messageId, conversationId, text, language })
			});
			if (!response.ok) {
				delete sessionAnalysis[messageId];
				return;
			}
			const analysis: MessageAnalysis = await response.json();
			sessionAnalysis[messageId] = analysis;
			if (analysis.errors.length > 0 && analysis.explanation) {
				announcer.say(`Corrección de tu mensaje: ${analysis.explanation}`);
			}
		} catch {
			delete sessionAnalysis[messageId];
		}
	}

	function submit(event: SubmitEvent) {
		event.preventDefault();
		const text = input.trim();
		if (!text || !data.activeId || busy) return;
		input = '';
		lastSent = text;
		const id = crypto.randomUUID();
		chat.sendMessage({ id, role: 'user', parts: [{ type: 'text', text }] });
		analyzeMessage(id, data.activeId, text);
	}

	let translatingInput = $state(false);

	async function translateInput() {
		const text = input.trim();
		const targetLanguage = data.activeConversation?.targetLanguage;
		if (!text || !targetLanguage || translatingInput) return;

		translatingInput = true;
		try {
			const response = await fetch('/chat/translate-input', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ text, targetLanguage })
			});
			if (!response.ok) return;
			const result: { translation: string } = await response.json();
			input = result.translation;
			announcer.say(`Mensaje traducido: ${result.translation}`);
		} finally {
			translatingInput = false;
		}
	}

	let sessionSuggestions: Record<string, string[] | 'loading'> = $state({});

	async function fetchSuggestions(messageId: string, text: string) {
		const language = data.activeConversation?.targetLanguage;
		if (!language) return;

		sessionSuggestions[messageId] = 'loading';
		try {
			const response = await fetch('/chat/suggestions', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ text, language, focus: data.activeConversation?.title })
			});
			if (!response.ok) {
				delete sessionSuggestions[messageId];
				return;
			}
			const result: { suggestions: string[] } = await response.json();
			sessionSuggestions[messageId] = result.suggestions;
			if (result.suggestions.length > 0) {
				announcer.say(`${result.suggestions.length} sugerencias de respuesta`);
			}
		} catch {
			delete sessionSuggestions[messageId];
		}
	}

	function useSuggestion(text: string) {
		input = text;
	}

	let wordLookup: WordLookup = $state('idle');

	async function lookupWord(word: string, sentence: string) {
		const targetLanguage = data.activeConversation?.targetLanguage;
		if (!targetLanguage) return;

		wordLookup = 'loading';
		try {
			const response = await fetch('/chat/word', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ word, sentence, targetLanguage })
			});
			if (!response.ok) {
				wordLookup = 'error';
				return;
			}
			const result: {
				lemma: string;
				partOfSpeech: string;
				translation: string;
				explanation: string;
			} = await response.json();
			wordLookup = { word, sentence, ...result, saved: false };
		} catch {
			wordLookup = 'error';
		}
	}

	async function saveWord() {
		if (wordLookup === 'idle' || wordLookup === 'loading' || wordLookup === 'error') return;
		if (!data.activeId || wordLookup.saved) return;
		const current = wordLookup;

		try {
			const response = await fetch('/chat/word', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					conversationId: data.activeId,
					word: current.word,
					lemma: current.lemma,
					partOfSpeech: current.partOfSpeech,
					translation: current.translation,
					exampleSentence: current.sentence
				})
			});
			// Only mark saved if the panel is still showing this same lookup
			// (the learner may have clicked a different word meanwhile).
			if (response.ok && wordLookup === current) {
				wordLookup.saved = true;
			}
		} catch {
			// leave it as-is so the learner can retry
		}
	}

	function appendTranscript(text: string) {
		input = input.trim() ? `${input.trim()} ${text}` : text;
	}

	function confirmDelete(event: MouseEvent) {
		if (!confirm('¿Borrar esta conversación? No se puede deshacer.')) {
			event.preventDefault();
		}
	}

	const dateFormatter = new Intl.DateTimeFormat('es', {
		day: 'numeric',
		month: 'short',
		hour: '2-digit',
		minute: '2-digit'
	});

	function formatDate(date: Date) {
		return dateFormatter.format(date);
	}
</script>

<svelte:head><title>{`${data.activeConversation?.title ?? 'Chat'} · Langua`}</title></svelte:head>

<div class="flex h-full flex-col">
	<h1 class="sr-only">{data.activeConversation?.title ?? 'Chat'}</h1>
	<div class="mx-auto w-full max-w-6xl shrink-0 border-b border-border px-3 py-2 sm:px-6 sm:py-3">
		<div class="flex items-center gap-2">
			<button
				type="button"
				onclick={() => (conversationsOpen = true)}
				aria-label="Ver conversaciones"
				class="inline-flex min-h-10 min-w-10 items-center justify-center rounded-md border border-border sm:hidden"
			>
				<MessagesSquare class="h-5 w-5" aria-hidden="true" />
			</button>

			<Button
				onclick={() => {
					newTitle = '';
					newDialog?.showModal();
				}}
			>
				<Plus class="h-4 w-4" aria-hidden="true" />
				<span class="sm:hidden">Nueva</span>
				<span class="hidden sm:inline">Nueva conversación</span>
			</Button>

			{#if data.activeId}
				<div class="ml-auto flex items-center gap-2 sm:hidden">
					<button
						type="button"
						onclick={() => (settingsOpen = !settingsOpen)}
						aria-expanded={settingsOpen}
						aria-controls="chat-settings"
						aria-label="Opciones del chat"
						class="inline-flex min-h-10 min-w-10 items-center justify-center rounded-md border border-border sm:hidden"
					>
						<SlidersHorizontal class="h-5 w-5" aria-hidden="true" />
					</button>
					<button
						type="button"
						onclick={() => (wordPanelOpen = true)}
						aria-label="Ver panel de palabra"
						class="inline-flex min-h-10 min-w-10 items-center justify-center rounded-md border border-border sm:hidden"
					>
						<BookOpen class="h-5 w-5" aria-hidden="true" />
					</button>
				</div>

				<!-- Inline from sm up; on phones they fold behind «Opciones del chat». -->
				<div class="ml-auto hidden flex-wrap items-center gap-x-4 gap-y-1 sm:flex">
					{@render settings()}
				</div>
			{/if}
		</div>
		{#if data.activeId}
			<div
				id="chat-settings"
				class={['mt-2 flex-col items-start gap-1 sm:hidden', settingsOpen ? 'flex' : 'hidden']}
			>
				{@render settings()}
			</div>
		{/if}
	</div>

	{#if conversationsOpen}
		<button
			type="button"
			tabindex="-1"
			aria-hidden="true"
			onclick={() => (conversationsOpen = false)}
			class="fixed inset-0 z-30 bg-black/40 sm:hidden"
		></button>
	{/if}

	<div class="mx-auto flex min-h-0 w-full max-w-6xl flex-1 gap-6 p-3 sm:flex-row sm:p-6">
		<aside
			{@attach drawer(conversationsOpen, () => (conversationsOpen = false), 'Conversaciones')}
			class="fixed inset-y-0 left-0 z-40 w-72 max-w-[85%] shrink-0 flex-col gap-2 overflow-y-auto border-r p-4 shadow-xl sm:static sm:z-auto sm:flex sm:w-48 sm:max-w-none sm:gap-1 sm:border-0 sm:p-0 sm:shadow-none"
			style:border-color="var(--color-border)"
			style:background-color="var(--color-background)"
			class:hidden={!conversationsOpen}
			class:flex={conversationsOpen}
		>
			<div class="mb-2 flex items-center justify-between sm:hidden">
				<h2 class="text-sm font-medium" style:color="var(--color-ink-muted)">Conversaciones</h2>
				<button
					type="button"
					onclick={() => (conversationsOpen = false)}
					aria-label="Cerrar"
					class="rounded-md p-1"
				>
					<svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" style:color="var(--color-ink)">
						<path
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							d="M6 6l12 12M18 6L6 18"
						/>
					</svg>
				</button>
			</div>

			<ul class="flex flex-col gap-1">
				{#each data.conversations as conversation (conversation.id)}
					<li class="flex items-center gap-1">
						<a
							href={resolve(`/chat/${conversation.id}`)}
							onclick={() => (conversationsOpen = false)}
							class="flex min-w-0 flex-1 flex-col gap-0.5 rounded-md px-2 py-1.5"
							style:background-color={conversation.id === data.activeId
								? 'var(--color-surface)'
								: 'transparent'}
						>
							<span class="line-clamp-3 text-sm">{conversation.title ?? 'Conversación libre'}</span>
							<span class="truncate text-xs" style:color="var(--color-ink-muted)">
								{formatDate(conversation.createdAt)}
							</span>
						</a>
						<form method="POST" action="?/delete" use:enhance>
							<input type="hidden" name="id" value={conversation.id} />
							<button
								type="submit"
								onclick={confirmDelete}
								aria-label="Borrar conversación"
								class="shrink-0 rounded-md p-1.5 opacity-60 hover:opacity-100"
							>
								<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" style:color="var(--color-ink)">
									<path
										stroke="currentColor"
										stroke-width="1.6"
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M5 7h14M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2m3 0-.8 12.1a2 2 0 0 1-2 1.9H7.8a2 2 0 0 1-2-1.9L5 7h14Z"
									/>
								</svg>
							</button>
						</form>
					</li>
				{/each}
			</ul>
		</aside>

		<section class="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
			{#if !data.activeId}
				<p style:color="var(--color-ink-muted)">Crea una conversación para empezar a practicar.</p>
			{:else}
				<div class="flex flex-1 flex-col gap-3 overflow-y-auto">
					{#each chat.messages as message (message.id)}
						{@const text = message.parts
							.filter((part) => part.type === 'text')
							.map((part) => part.text)
							.join('')}
						{@const analysis =
							message.role === 'user' ? analysisByMessageId[message.id] : undefined}
						{@const analysisData = analysis && analysis !== 'loading' ? analysis : null}
						{@const suggestions =
							message.role === 'assistant' ? sessionSuggestions[message.id] : undefined}
						{@const translation =
							message.role === 'assistant' ? translationByMessageId[message.id] : undefined}
						<div
							class="flex max-w-[80%] flex-col gap-1"
							class:items-end={message.role === 'user'}
							class:self-end={message.role === 'user'}
						>
							<div class="flex items-end gap-1.5">
								<div
									{@attach rovingFocus}
									lang={data.activeConversation?.targetLanguage}
									class="min-w-0 rounded-lg px-3 py-2 text-sm break-words"
									style:background-color={message.role === 'user'
										? 'var(--color-accent)'
										: 'var(--color-surface)'}
									style:color={message.role === 'user'
										? 'var(--color-on-accent)'
										: 'var(--color-ink)'}
								>
									{#if analysisData && analysisData.errors.length > 0}
										{#each buildHighlightSegments(text, analysisData.errors) as segment, i (i)}
											{#if segment.type === 'spelling'}
												<span
													class="underline decoration-current decoration-wavy decoration-2 underline-offset-4"
													>{segment.text}<span class="sr-only" lang="es">
														(error de ortografía)</span
													></span
												>
											{:else if segment.type === 'grammar'}
												<span
													class="underline decoration-current decoration-dashed decoration-2 underline-offset-4"
													>{segment.text}<span class="sr-only" lang="es">
														(error de gramática)</span
													></span
												>
											{:else}
												{segment.text}
											{/if}
										{/each}
									{:else if message.role === 'assistant'}
										{#each splitIntoWords(text) as token, i (i)}
											{#if token.clickable}
												<button
													type="button"
													data-word
													onclick={() =>
														lookupWord(token.text, sentenceContaining(text, token.start))}
													class="hover:underline"
													style:border="none"
													style:background="transparent"
													style:padding="0"
													style:margin="0"
													style:font="inherit"
													style:color="inherit"
													style:cursor="pointer">{token.text}</button
												>
											{:else}
												{token.text}
											{/if}
										{/each}
									{:else}
										{text}
									{/if}
								</div>
								{#if message.role === 'assistant' && text}
									<SpeakButton {text} language={data.activeConversation?.targetLanguage} />
								{/if}
							</div>
							{#if message.role === 'assistant' && text && !(busy && message.id === chat.messages.at(-1)?.id)}
								<button
									type="button"
									onclick={() => toggleTranslation(message.id, text)}
									class="w-fit text-xs underline"
									style:color="var(--color-ink-muted)"
								>
									{expandedTranslation[message.id] ? 'Ocultar traducción' : 'Traducir'}
								</button>
								{#if expandedTranslation[message.id]}
									{#if translation === 'loading'}
										<p class="text-xs italic" style:color="var(--color-ink-muted)">
											Traduciendo...
										</p>
									{:else if translation}
										<p class="text-xs italic" style:color="var(--color-ink-muted)">
											{translation}
										</p>
									{/if}
								{/if}
							{/if}
							{#if analysis === 'loading'}
								<p class="text-xs italic" style:color="var(--color-ink-muted)">
									Revisando texto...
								</p>
							{:else if analysisData?.explanation}
								<p class="text-xs italic" style:color="var(--color-ink-muted)">
									{analysisData.explanation}
								</p>
							{/if}
							{#if analysisData && analysisData.errors.length > 0}
								<!-- Screen readers get the kind of error inline instead. -->
								<p class="text-xs text-ink-muted" aria-hidden="true">
									<span class="underline decoration-wavy underline-offset-4">ortografía</span>
									·
									<span class="underline decoration-dashed underline-offset-4">gramática</span>
								</p>
							{/if}
							{#if suggestions === 'loading'}
								<p class="text-xs italic" style:color="var(--color-ink-muted)">
									Pensando sugerencias...
								</p>
							{:else if Array.isArray(suggestions) && suggestions.length > 0}
								<div class="flex flex-wrap gap-1.5">
									{#each suggestions as suggestion, i (i)}
										<Chip
											lang={data.activeConversation?.targetLanguage}
											onclick={() => useSuggestion(suggestion)}
										>
											{suggestion}
										</Chip>
									{/each}
								</div>
							{/if}
						</div>
					{/each}
					{#if startFailedFor === data.activeId && chat.messages.length === 0}
						<div class="flex flex-wrap items-center gap-2 text-sm" role="alert">
							<span style:color="var(--color-danger)">No se pudo empezar la conversación.</span>
							<button
								type="button"
								onclick={() => data.activeId && startConversation(data.activeId)}
								class="underline"
							>
								Reintentar
							</button>
						</div>
					{/if}
					{#if chat.error}
						<div class="flex flex-wrap items-center gap-2 text-sm" role="alert">
							<span style:color="var(--color-danger)">
								El tutor no ha podido responder. Puede que falte crédito de IA en Seilide o que haya
								un problema de conexión.
							</span>
							<button type="button" onclick={retryReply} class="underline">Reintentar</button>
							{#if lastSent && !input}
								<button type="button" onclick={() => (input = lastSent)} class="underline">
									Recuperar mi mensaje
								</button>
							{/if}
						</div>
					{/if}
				</div>

				<form onsubmit={submit} class="flex items-center gap-2">
					<RecordButton
						onTranscript={appendTranscript}
						language={data.activeConversation?.targetLanguage}
						disabled={busy}
					/>
					<input
						bind:value={input}
						aria-label="Mensaje para el tutor"
						maxlength={2000}
						lang={data.activeConversation?.targetLanguage}
						type="text"
						placeholder="Escribe o graba un mensaje..."
						disabled={busy}
						class="min-w-0 flex-1 rounded-md border px-3 py-2 text-sm"
						style:border-color="var(--color-border)"
						style:background-color="var(--color-background)"
					/>
					<Button
						variant="secondary"
						onclick={translateInput}
						disabled={busy || translatingInput || !input.trim()}
						aria-label={translatingInput ? 'Traduciendo…' : 'Traducir mi mensaje al idioma'}
					>
						<Languages class="h-4 w-4 sm:hidden" aria-hidden="true" />
						<span class="hidden sm:inline">{translatingInput ? 'Traduciendo...' : 'Traducir'}</span>
					</Button>
					<Button type="submit" disabled={busy} aria-label="Enviar">
						<SendHorizontal class="h-4 w-4 sm:hidden" aria-hidden="true" />
						<span class="hidden sm:inline">Enviar</span>
					</Button>
				</form>
			{/if}
		</section>

		{#if data.activeId}
			<WordPanel
				lookup={wordLookup}
				language={data.activeConversation?.targetLanguage}
				idleText="Haz clic en una palabra de una respuesta del tutor para ver su información."
				open={wordPanelOpen}
				onclose={() => (wordPanelOpen = false)}
				onsave={saveWord}
			/>
		{/if}
	</div>
</div>

<dialog
	bind:this={newDialog}
	aria-labelledby="new-conversation-title"
	onclick={(event) => {
		if (event.target === newDialog) newDialog?.close();
	}}
	class="m-auto w-full max-w-sm rounded-lg p-0 backdrop:bg-black/40"
	style:background-color="var(--color-background)"
	style:color="var(--color-ink)"
>
	<form
		method="POST"
		action="?/new"
		use:enhance={() => {
			return async ({ result, update }) => {
				if (result.type === 'redirect') {
					newDialog?.close();
				}
				await update();
			};
		}}
		class="flex flex-col gap-4 p-5"
	>
		<h2 id="new-conversation-title" class="text-lg font-semibold">Nueva conversación</h2>

		<label class="flex flex-col gap-1 text-sm">
			Idioma
			<select
				name="targetLanguage"
				required
				value={data.user.targetLanguage ?? ''}
				class="rounded-md border px-3 py-2"
				style:border-color="var(--color-border)"
				style:background-color="var(--color-surface)"
			>
				<option value="" disabled>Elige un idioma</option>
				{#each LANGUAGES as lang (lang.code)}
					<option value={lang.code}>{lang.label}</option>
				{/each}
			</select>
		</label>

		<label class="flex flex-col gap-1 text-sm">
			Nivel
			<select
				name="level"
				required
				value="beginner"
				class="rounded-md border px-3 py-2"
				style:border-color="var(--color-border)"
				style:background-color="var(--color-surface)"
			>
				{#each LEVELS as level (level.code)}
					<option value={level.code}>{level.label}</option>
				{/each}
			</select>
		</label>

		<div class="flex flex-wrap gap-1.5">
			{#each CONVERSATION_TEMPLATES as template (template.label)}
				<Chip onclick={() => (newTitle = template.title)}>
					{template.label}
				</Chip>
			{/each}
		</div>

		<label class="flex flex-col gap-1 text-sm">
			¿De qué quieres hablar? (opcional)
			<textarea
				name="title"
				bind:value={newTitle}
				rows="3"
				placeholder="Ej: practicar verbos modales, hablar de un viaje... o elige una plantilla arriba"
				class="rounded-md border px-3 py-2 text-sm"
				style:border-color="var(--color-border)"
				style:background-color="var(--color-surface)"></textarea>
		</label>

		{#if form?.message}
			<p class="text-sm text-danger">{form.message}</p>
		{/if}

		<div class="flex justify-end gap-2">
			<Button variant="secondary" onclick={() => newDialog?.close()}>Cancelar</Button>
			<Button type="submit">Crear</Button>
		</div>
	</form>
</dialog>

{#snippet settings()}
	<div class="flex flex-wrap items-center gap-2 text-sm">
		<Button
			variant="secondary"
			onclick={extractVocabulary}
			disabled={vocabExtraction === 'loading'}
		>
			Extraer vocabulario
		</Button>
		{#if vocabExtraction === 'loading'}
			<span class="text-xs text-ink-muted italic">Extrayendo...</span>
		{:else if vocabExtraction === 'error'}
			<span class="text-xs text-danger">No se pudo extraer el vocabulario.</span>
		{:else if vocabExtraction !== 'idle'}
			<span class="text-xs text-ink-muted">
				{vocabExtraction.added > 0
					? `${vocabExtraction.added} palabra${vocabExtraction.added === 1 ? '' : 's'} nueva${vocabExtraction.added === 1 ? '' : 's'}`
					: 'Sin palabras nuevas'} —
				<a href={resolve('/study')} class="text-accent underline">ver libro de estudio</a>
			</span>
		{/if}
	</div>
	<Switch checked={autoPlay} label="Leer respuestas en voz alta" onchange={toggleAutoPlay} />
	<Switch checked={quickReplies} label="Sugerencias de respuesta" onchange={toggleQuickReplies} />
{/snippet}
