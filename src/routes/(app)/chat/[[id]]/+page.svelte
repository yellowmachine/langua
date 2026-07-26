<script lang="ts">
	import { Chat } from '@ai-sdk/svelte';
	import { DefaultChatTransport } from 'ai';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import SpeakButton from '$lib/components/SpeakButton.svelte';
	import RecordButton from '$lib/components/RecordButton.svelte';
	import { fetchSpeechAudio } from '$lib/audio';
	import { LANGUAGES } from '$lib/languages';
	import type { ActionData, PageData } from './$types';

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

	let chat = $derived(
		new Chat({
			id: data.activeId ?? undefined,
			messages: data.messages,
			transport: new DefaultChatTransport({ api: resolve('/chat/api') }),
			onFinish: ({ message, isAbort, isError }) => {
				if (!autoPlay || isAbort || isError) return;
				const text = message.parts
					.filter((part) => part.type === 'text')
					.map((part) => part.text)
					.join('');
				if (text) {
					fetchSpeechAudio(text, data.activeConversation?.targetLanguage).then((audio) =>
						audio?.play()
					);
				}
			}
		})
	);

	let input = $state('');
	let busy = $derived(chat.status === 'streaming' || chat.status === 'submitted');
	let newDialog: HTMLDialogElement | undefined = $state();

	function submit(event: SubmitEvent) {
		event.preventDefault();
		const text = input.trim();
		if (!text || !data.activeId || busy) return;
		input = '';
		chat.sendMessage({ text });
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

<div class="mx-auto flex h-full max-w-4xl gap-6 p-6">
	<aside class="flex w-48 shrink-0 flex-col gap-3 overflow-y-auto">
		<button
			type="button"
			onclick={() => newDialog?.showModal()}
			class="w-full rounded-md px-3 py-2 text-sm font-medium text-white"
			style:background-color="var(--color-accent)"
		>
			Nueva conversación
		</button>

		<ul class="flex flex-col gap-1">
			{#each data.conversations as conversation (conversation.id)}
				<li class="flex items-center gap-1">
					<a
						href={resolve(`/chat/${conversation.id}`)}
						class="flex min-w-0 flex-1 flex-col gap-0.5 rounded-md px-2 py-1.5"
						style:background-color={conversation.id === data.activeId
							? 'var(--color-surface)'
							: 'transparent'}
					>
						<span class="truncate text-sm">{conversation.title ?? 'Conversación libre'}</span>
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

	<section class="flex min-h-0 flex-1 flex-col gap-4">
		{#if !data.activeId}
			<p style:color="var(--color-ink-muted)">Crea una conversación para empezar a practicar.</p>
		{:else}
			<div class="flex items-center justify-end gap-2 text-sm">
				<span style:color="var(--color-ink-muted)">Leer respuestas en voz alta</span>
				<button
					type="button"
					role="switch"
					aria-checked={autoPlay}
					aria-label="Leer respuestas en voz alta"
					onclick={toggleAutoPlay}
					class="relative inline-flex h-5 w-9 shrink-0 rounded-full border transition-colors"
					style:border-color="var(--color-border)"
					style:background-color={autoPlay ? 'var(--color-accent)' : 'var(--color-surface)'}
				>
					<span
						class="absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white transition-transform"
						class:translate-x-4={autoPlay}
						class:translate-x-0.5={!autoPlay}
					></span>
				</button>
			</div>

			<div class="flex flex-1 flex-col gap-3 overflow-y-auto">
				{#each chat.messages as message (message.id)}
					{@const text = message.parts
						.filter((part) => part.type === 'text')
						.map((part) => part.text)
						.join('')}
					<div class="flex max-w-[80%] items-end gap-1.5" class:self-end={message.role === 'user'}>
						<div
							class="rounded-lg px-3 py-2 text-sm"
							style:background-color={message.role === 'user'
								? 'var(--color-accent)'
								: 'var(--color-surface)'}
							style:color={message.role === 'user' ? 'white' : 'var(--color-ink)'}
						>
							{text}
						</div>
						{#if message.role === 'assistant' && text}
							<SpeakButton {text} language={data.activeConversation?.targetLanguage} />
						{/if}
					</div>
				{/each}
			</div>

			<form onsubmit={submit} class="flex items-center gap-2">
				<RecordButton
					onTranscript={appendTranscript}
					language={data.activeConversation?.targetLanguage}
					disabled={busy}
				/>
				<input
					bind:value={input}
					type="text"
					placeholder="Escribe o graba un mensaje..."
					disabled={busy}
					class="flex-1 rounded-md border px-3 py-2 text-sm"
					style:border-color="var(--color-border)"
					style:background-color="var(--color-background)"
				/>
				<button
					type="submit"
					disabled={busy}
					class="rounded-md px-4 py-2 text-sm font-medium text-white"
					style:background-color="var(--color-accent)"
				>
					Enviar
				</button>
			</form>
		{/if}
	</section>
</div>

<dialog
	bind:this={newDialog}
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
		<h2 class="text-lg font-semibold">Nueva conversación</h2>

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
			¿De qué quieres hablar? (opcional)
			<textarea
				name="title"
				rows="3"
				placeholder="Ej: practicar verbos modales, hablar de un viaje..."
				class="rounded-md border px-3 py-2 text-sm"
				style:border-color="var(--color-border)"
				style:background-color="var(--color-surface)"></textarea>
		</label>

		{#if form?.message}
			<p class="text-sm text-red-600">{form.message}</p>
		{/if}

		<div class="flex justify-end gap-2">
			<button
				type="button"
				onclick={() => newDialog?.close()}
				class="rounded-md border px-3 py-2 text-sm"
				style:border-color="var(--color-border)"
			>
				Cancelar
			</button>
			<button
				type="submit"
				class="rounded-md px-3 py-2 text-sm font-medium text-white"
				style:background-color="var(--color-accent)"
			>
				Crear
			</button>
		</div>
	</form>
</dialog>
