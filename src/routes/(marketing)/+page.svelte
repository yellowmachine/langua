<script lang="ts">
	import { resolve } from '$app/paths';
	import favicon from '$lib/assets/favicon.svg';
</script>

<div
	class="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-8 p-6 text-center"
>
	<img src={favicon} alt="" class="h-16 w-16 rounded-2xl" />

	<div class="flex flex-col gap-3">
		<h1 class="text-3xl font-semibold">Langua</h1>
		<p class="text-lg" style:color="var(--color-ink-muted)">
			Aprende idiomas en familia, en vuestro propio servidor.
		</p>
	</div>

	<p class="max-w-md text-sm" style:color="var(--color-ink-muted)">
		Practica conversación con una IA — por texto o por voz —, haz ejercicios de comprensión auditiva
		y sigue tu progreso. Cada miembro de la familia tiene su propia cuenta y su propio avance.
	</p>

	<a
		href={resolve('/login')}
		class="rounded-md px-5 py-2.5 text-sm font-medium text-white"
		style:background-color="var(--color-accent)"
	>
		Entrar
	</a>
</div>
