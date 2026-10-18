<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	type Setup = { qrSvg: string; secret: string; backupCodes: string[] };

	// Kept outside `form` so a mistyped verification code doesn't wipe the QR
	// and backup codes the user is in the middle of saving.
	let setup = $state<Setup | null>(null);

	let activeSetup = $derived(
		data.twoFactorEnabled
			? null
			: (setup ?? (form?.formId === 'enableTwoFactor' && 'setup' in form ? form.setup : null))
	);

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
		class="rounded-lg border p-4"
		style:border-color="var(--color-border)"
		style:background-color="var(--color-surface)"
	>
		<h2 class="mb-3 text-sm font-medium">Cambiar contraseña</h2>
		<form method="POST" action="?/changePassword" use:enhance class="flex flex-col gap-4">
			<label class="flex flex-col gap-1 text-sm">
				Contraseña actual
				<input
					name="currentPassword"
					type="password"
					autocomplete="current-password"
					required
					class="rounded-md border px-3 py-2"
					style:border-color="var(--color-border)"
					style:background-color="var(--color-background)"
				/>
			</label>

			<label class="flex flex-col gap-1 text-sm">
				Nueva contraseña
				<input
					name="newPassword"
					type="password"
					autocomplete="new-password"
					required
					minlength="8"
					class="rounded-md border px-3 py-2"
					style:border-color="var(--color-border)"
					style:background-color="var(--color-background)"
				/>
			</label>

			<label class="flex flex-col gap-1 text-sm">
				Repite la nueva contraseña
				<input
					name="confirmPassword"
					type="password"
					autocomplete="new-password"
					required
					minlength="8"
					class="rounded-md border px-3 py-2"
					style:border-color="var(--color-border)"
					style:background-color="var(--color-background)"
				/>
			</label>

			{#if messageFor('changePassword')}
				<p class="text-sm text-red-600">{messageFor('changePassword')}</p>
			{/if}
			{#if form?.formId === 'changePassword' && 'success' in form}
				<p class="text-sm" style:color="var(--color-accent)">Contraseña actualizada.</p>
			{/if}

			<button
				type="submit"
				class="self-start rounded-md px-3 py-2 text-sm font-medium text-white"
				style:background-color="var(--color-accent)"
			>
				Guardar
			</button>
		</form>
	</section>

	<section
		class="flex flex-col gap-4 rounded-lg border p-4"
		style:border-color="var(--color-border)"
		style:background-color="var(--color-surface)"
	>
		<div>
			<h2 class="mb-1 text-sm font-medium">Verificación en dos pasos</h2>
			<p class="text-sm" style:color="var(--color-ink-muted)">
				{#if data.twoFactorEnabled}
					Activada. Al iniciar sesión te pediremos un código de tu app de autenticación.
				{:else}
					Añade un código de una app de autenticación (Aegis, Google Authenticator, 1Password…)
					además de tu contraseña.
				{/if}
			</p>
		</div>

		{#if form?.formId === 'verifyTwoFactor' && 'success' in form}
			<p class="text-sm" style:color="var(--color-accent)">Verificación en dos pasos activada.</p>
		{/if}
		{#if form?.formId === 'disableTwoFactor' && 'success' in form}
			<p class="text-sm" style:color="var(--color-accent)">
				Verificación en dos pasos desactivada.
			</p>
		{/if}

		{#if data.twoFactorEnabled}
			<form method="POST" action="?/regenerateBackupCodes" use:enhance class="flex flex-col gap-3">
				<h3 class="text-sm font-medium">Códigos de recuperación</h3>
				<p class="text-sm" style:color="var(--color-ink-muted)">
					Genera códigos nuevos si has usado o perdido los anteriores. Los antiguos dejarán de
					funcionar.
				</p>
				<label class="flex flex-col gap-1 text-sm">
					Contraseña
					<input
						name="password"
						type="password"
						autocomplete="current-password"
						required
						class="rounded-md border px-3 py-2"
						style:border-color="var(--color-border)"
						style:background-color="var(--color-background)"
					/>
				</label>
				{#if messageFor('regenerateBackupCodes')}
					<p class="text-sm text-red-600">{messageFor('regenerateBackupCodes')}</p>
				{/if}
				{#if form?.formId === 'regenerateBackupCodes' && 'backupCodes' in form && form.backupCodes}
					{@render backupCodeList(form.backupCodes)}
				{/if}
				<button
					type="submit"
					class="self-start rounded-md border px-3 py-2 text-sm font-medium"
					style:border-color="var(--color-border)"
				>
					Generar códigos nuevos
				</button>
			</form>

			<form method="POST" action="?/disableTwoFactor" use:enhance class="flex flex-col gap-3">
				<h3 class="text-sm font-medium">Desactivar</h3>
				<label class="flex flex-col gap-1 text-sm">
					Contraseña
					<input
						name="password"
						type="password"
						autocomplete="current-password"
						required
						class="rounded-md border px-3 py-2"
						style:border-color="var(--color-border)"
						style:background-color="var(--color-background)"
					/>
				</label>
				{#if messageFor('disableTwoFactor')}
					<p class="text-sm text-red-600">{messageFor('disableTwoFactor')}</p>
				{/if}
				<button
					type="submit"
					class="self-start rounded-md px-3 py-2 text-sm font-medium text-white"
					style:background-color="#dc2626"
				>
					Desactivar verificación en dos pasos
				</button>
			</form>
		{:else if activeSetup}
			<ol class="flex list-decimal flex-col gap-4 pl-5 text-sm">
				<li class="flex flex-col gap-2">
					Escanea este código QR con tu app de autenticación.
					<div class="w-48 rounded-md bg-white p-2">
						<!-- eslint-disable-next-line svelte/no-at-html-tags -- SVG generated server-side by the qrcode lib -->
						{@html activeSetup.qrSvg}
					</div>
					<span style:color="var(--color-ink-muted)">
						¿No puedes escanearlo? Introduce esta clave a mano:
						<code class="font-mono break-all">{activeSetup.secret}</code>
					</span>
				</li>
				<li class="flex flex-col gap-2">
					Guarda estos códigos de recuperación en un sitio seguro. Cada uno sirve una sola vez si
					pierdes el móvil.
					{@render backupCodeList(activeSetup.backupCodes)}
				</li>
				<li>
					<form
						method="POST"
						action="?/verifyTwoFactor"
						use:enhance={() =>
							async ({ result, update }) => {
								// Done with this secret; don't resurface it if 2FA is
								// later disabled in the same page visit.
								if (result.type === 'success') setup = null;
								await update();
							}}
						class="flex flex-col gap-2"
					>
						<label class="flex flex-col gap-1">
							Introduce el código que muestra la app para terminar
							<input
								name="code"
								type="text"
								inputmode="numeric"
								autocomplete="one-time-code"
								pattern="[0-9 ]*"
								maxlength="7"
								required
								class="max-w-40 rounded-md border px-3 py-2 font-mono tracking-widest"
								style:border-color="var(--color-border)"
								style:background-color="var(--color-background)"
							/>
						</label>
						{#if messageFor('verifyTwoFactor')}
							<p class="text-red-600">{messageFor('verifyTwoFactor')}</p>
						{/if}
						<button
							type="submit"
							class="self-start rounded-md px-3 py-2 font-medium text-white"
							style:background-color="var(--color-accent)"
						>
							Activar
						</button>
					</form>
				</li>
			</ol>
		{:else}
			<form
				method="POST"
				action="?/enableTwoFactor"
				use:enhance={() =>
					async ({ result, update }) => {
						if (result.type === 'success' && result.data?.setup) {
							setup = result.data.setup as Setup;
						}
						await update();
					}}
				class="flex flex-col gap-3"
			>
				<label class="flex flex-col gap-1 text-sm">
					Confirma tu contraseña para empezar
					<input
						name="password"
						type="password"
						autocomplete="current-password"
						required
						class="rounded-md border px-3 py-2"
						style:border-color="var(--color-border)"
						style:background-color="var(--color-background)"
					/>
				</label>
				{#if messageFor('enableTwoFactor')}
					<p class="text-sm text-red-600">{messageFor('enableTwoFactor')}</p>
				{/if}
				<button
					type="submit"
					class="self-start rounded-md px-3 py-2 text-sm font-medium text-white"
					style:background-color="var(--color-accent)"
				>
					Configurar
				</button>
			</form>
		{/if}
	</section>

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

{#snippet backupCodeList(codes: string[])}
	<ul
		class="grid grid-cols-2 gap-1 rounded-md border p-3 font-mono text-sm"
		style:border-color="var(--color-border)"
		style:background-color="var(--color-background)"
	>
		{#each codes as code (code)}
			<li>{code}</li>
		{/each}
	</ul>
{/snippet}
