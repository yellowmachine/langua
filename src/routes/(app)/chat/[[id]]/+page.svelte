<script lang="ts">
	import { Chat } from '@ai-sdk/svelte';
	import { DefaultChatTransport } from 'ai';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let chat = $derived(
		new Chat({
			id: data.activeId ?? undefined,
			messages: data.messages,
			transport: new DefaultChatTransport({ api: resolve('/chat/api') })
		})
	);

	let input = $state('');
	let busy = $derived(chat.status === 'streaming' || chat.status === 'submitted');

	function submit(event: SubmitEvent) {
		event.preventDefault();
		const text = input.trim();
		if (!text || !data.activeId || busy) return;
		input = '';
		chat.sendMessage({ text });
	}
</script>

<div class="mx-auto flex min-h-screen max-w-4xl gap-6 p-6">
	<aside class="flex w-48 shrink-0 flex-col gap-3">
		<a href={resolve('/')} class="text-sm underline" style:color="var(--color-ink-muted)">
			Volver
		</a>

		<form method="POST" action="?/new" use:enhance>
			<button
				type="submit"
				class="w-full rounded-md px-3 py-2 text-sm font-medium text-white"
				style:background-color="var(--color-accent)"
			>
				Nueva conversación
			</button>
		</form>

		<ul class="flex flex-col gap-1">
			{#each data.conversations as conversation (conversation.id)}
				<li>
					<a
						href={resolve(`/chat/${conversation.id}`)}
						class="block truncate rounded-md px-2 py-1.5 text-sm"
						style:background-color={conversation.id === data.activeId
							? 'var(--color-surface)'
							: 'transparent'}
					>
						{conversation.title ?? 'Conversación'}
					</a>
				</li>
			{/each}
		</ul>
	</aside>

	<section class="flex flex-1 flex-col gap-4">
		{#if !data.activeId}
			<p style:color="var(--color-ink-muted)">Crea una conversación para empezar a practicar.</p>
		{:else}
			<div class="flex flex-1 flex-col gap-3 overflow-y-auto">
				{#each chat.messages as message (message.id)}
					<div
						class="max-w-[80%] rounded-lg px-3 py-2 text-sm"
						class:self-end={message.role === 'user'}
						style:background-color={message.role === 'user'
							? 'var(--color-accent)'
							: 'var(--color-surface)'}
						style:color={message.role === 'user' ? 'white' : 'var(--color-ink)'}
					>
						{#each message.parts as part, i (i)}
							{#if part.type === 'text'}
								{part.text}
							{/if}
						{/each}
					</div>
				{/each}
			</div>

			<form onsubmit={submit} class="flex gap-2">
				<input
					bind:value={input}
					type="text"
					placeholder="Escribe un mensaje..."
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
