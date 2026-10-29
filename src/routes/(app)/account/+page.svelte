<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const dateFormatter = new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' });

	let newToken = $derived(
		form?.formId === 'createToken' && 'token' in form && form.token
			? { name: form.name, token: form.token }
			: null
	);
	let copied = $state(false);

	async function copyToken(token: string) {
		await navigator.clipboard.writeText(token);
		copied = true;
	}

	function messageFor(formId: string) {
		return form?.formId === formId && 'message' in form ? form.message : null;
	}
</script>

<div class="mx-auto flex max-w-2xl flex-col gap-8 p-6">
	<header>
		<h1 class="text-xl font-semibold">Mi cuenta</h1>
	</header>

	<section
		class="flex flex-col gap-4 rounded-lg border p-4"
		style:border-color="var(--color-border)"
		style:background-color="var(--color-surface)"
	>
		<div>
			<h2 class="mb-1 text-sm font-medium">Integraciones</h2>
			<p class="text-sm" style:color="var(--color-ink-muted)">
				Tokens para que otras apps (como JellyCartoon) te manden clips a Langua. Configura la app
				con la dirección <code class="font-mono">{page.url.origin}</code> y uno de estos tokens.
			</p>
		</div>

		{#if newToken}
			<div
				class="flex flex-col gap-2 rounded-md border p-3 text-sm"
				style:border-color="var(--color-accent)"
				style:background-color="var(--color-background)"
			>
				<p>
					Token «{newToken.name}» creado. Cópialo ahora: no se volverá a mostrar.
				</p>
				<code class="font-mono break-all">{newToken.token}</code>
				<button
					type="button"
					onclick={() => copyToken(newToken.token)}
					class="self-start rounded-md border px-3 py-1.5 text-sm"
					style:border-color="var(--color-border)"
				>
					{copied ? 'Copiado' : 'Copiar'}
				</button>
			</div>
		{/if}

		{#if data.tokens.length > 0}
			<ul class="flex flex-col divide-y divide-(--color-border) text-sm">
				{#each data.tokens as token (token.id)}
					<li class="flex items-center justify-between gap-3 py-2">
						<div class="flex flex-col">
							<span class="font-medium">{token.name}</span>
							<span class="text-xs" style:color="var(--color-ink-muted)">
								Creado {dateFormatter.format(token.createdAt)} ·
								{token.lastUsedAt
									? `último uso ${dateFormatter.format(token.lastUsedAt)}`
									: 'sin usar'}
							</span>
						</div>
						<form method="POST" action="?/revokeToken" use:enhance>
							<input type="hidden" name="id" value={token.id} />
							<button
								type="submit"
								class="rounded-md border px-3 py-1.5 text-sm text-red-600"
								style:border-color="var(--color-border)"
							>
								Revocar
							</button>
						</form>
					</li>
				{/each}
			</ul>
		{/if}

		<form
			method="POST"
			action="?/createToken"
			use:enhance={() =>
				async ({ update }) => {
					copied = false;
					await update();
				}}
			class="flex flex-col gap-3"
		>
			<label class="flex flex-col gap-1 text-sm">
				Nombre del token nuevo
				<input
					name="name"
					type="text"
					placeholder="JellyCartoon"
					maxlength="60"
					required
					class="rounded-md border px-3 py-2"
					style:border-color="var(--color-border)"
					style:background-color="var(--color-background)"
				/>
			</label>
			{#if messageFor('createToken')}
				<p class="text-sm text-red-600">{messageFor('createToken')}</p>
			{/if}
			<button
				type="submit"
				class="self-start rounded-md px-3 py-2 text-sm font-medium text-white"
				style:background-color="var(--color-accent)"
			>
				Crear token
			</button>
		</form>
	</section>
</div>
