import { LANGUAGES } from './languages';

// Integrations (JellyCartoon) send ISO 639-2 codes, as found in video
// containers and subtitle tracks; Langua uses ISO 639-1 (src/lib/languages.ts).

// ISO 639-2 has two codes for some languages: bibliographic (B, the one
// Matroska/ffprobe usually report) and terminology (T). Folded to T.
const BIBLIOGRAPHIC_TO_TERMINOLOGY: Record<string, string> = {
	alb: 'sqi',
	arm: 'hye',
	baq: 'eus',
	bur: 'mya',
	chi: 'zho',
	cze: 'ces',
	dut: 'nld',
	fre: 'fra',
	geo: 'kat',
	ger: 'deu',
	gre: 'ell',
	ice: 'isl',
	mac: 'mkd',
	mao: 'mri',
	may: 'msa',
	per: 'fas',
	rum: 'ron',
	slo: 'slk',
	tib: 'bod',
	wel: 'cym'
};

const LANGUA_BY_TERMINOLOGY: Record<string, (typeof LANGUAGES)[number]['code']> = {
	spa: 'es',
	eng: 'en',
	fra: 'fr',
	deu: 'de',
	ita: 'it',
	por: 'pt'
};

// Not a language: undetermined, multiple, no linguistic content, uncoded.
const NOT_A_LANGUAGE = new Set(['und', 'mul', 'zxx', 'mis']);

/**
 * Canonical ISO 639-2/T code, for telling whether two tracks are in the
 * same language even if Langua doesn't support it. null if unknown.
 */
export function normalizeIso6392(code: string | null | undefined): string | null {
	const lower = code?.trim().toLowerCase();
	if (!lower || !/^[a-z]{3}$/.test(lower) || NOT_A_LANGUAGE.has(lower)) return null;
	return BIBLIOGRAPHIC_TO_TERMINOLOGY[lower] ?? lower;
}

/** Langua's ISO 639-1 code for an ISO 639-2 one; null if unknown or not one Langua supports. */
export function languaLanguageFromIso6392(code: string | null | undefined): string | null {
	const normalized = normalizeIso6392(code);
	return normalized ? (LANGUA_BY_TERMINOLOGY[normalized] ?? null) : null;
}
