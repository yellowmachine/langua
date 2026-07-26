<script lang="ts">
	type Analysis = {
		register: 'very_informal' | 'informal' | 'neutral' | 'formal' | 'very_formal';
		registerNotes: string;
		naturalness:
			'native_sounding' | 'mostly_natural' | 'somewhat_stilted' | 'clearly_translated_sounding';
		naturalnessNotes: string;
		cefrLevel: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
		cefrNotes: string;
	};

	let { analysis }: { analysis: Analysis } = $props();

	const registerLabels: Record<Analysis['register'], string> = {
		very_informal: 'Muy informal',
		informal: 'Informal',
		neutral: 'Neutro',
		formal: 'Formal',
		very_formal: 'Muy formal'
	};

	const naturalnessLabels: Record<Analysis['naturalness'], string> = {
		native_sounding: 'Suena nativo',
		mostly_natural: 'Bastante natural',
		somewhat_stilted: 'Algo forzado',
		clearly_translated_sounding: 'Suena traducido'
	};
</script>

<div
	class="flex flex-col gap-2 rounded-md border px-3 py-2 text-sm"
	style:border-color="var(--color-border)"
>
	<div class="flex items-baseline justify-between gap-2">
		<span class="font-medium">Registro</span>
		<span style:color="var(--color-accent)">{registerLabels[analysis.register]}</span>
	</div>
	<p class="text-xs italic" style:color="var(--color-ink-muted)">{analysis.registerNotes}</p>

	<div class="flex items-baseline justify-between gap-2">
		<span class="font-medium">Naturalidad</span>
		<span style:color="var(--color-accent)">{naturalnessLabels[analysis.naturalness]}</span>
	</div>
	<p class="text-xs italic" style:color="var(--color-ink-muted)">{analysis.naturalnessNotes}</p>

	<div class="flex items-baseline justify-between gap-2">
		<span class="font-medium">Nivel CEFR</span>
		<span style:color="var(--color-accent)">{analysis.cefrLevel}</span>
	</div>
	<p class="text-xs italic" style:color="var(--color-ink-muted)">{analysis.cefrNotes}</p>
</div>
