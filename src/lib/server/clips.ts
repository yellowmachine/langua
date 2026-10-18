import { z } from 'zod';
import { languaLanguageFromIso6392, normalizeIso6392 } from '$lib/iso639';
import type { ClipCue } from './db/schema';

// Contract with JellyCartoon for POST /api/v1/clips. Error messages are
// short and in Spanish: JellyCartoon reads them out loud to the user.

export const MAX_CLIP_AUDIO_BYTES = 15 * 1024 * 1024;

const cueSchema = z.object({
	start: z.number().min(0),
	end: z.number().min(0),
	text: z.string()
});

const metadataSchema = z
	.object({
		source: z.string().trim().min(1).max(50),
		kind: z.enum(['episode', 'film']),
		title: z.string().trim().min(1).max(300),
		series: z.string().trim().max(300).nullish(),
		season: z.number().int().min(0).nullish(),
		episode: z.number().int().min(0).nullish(),
		year: z.number().int().min(1800).max(3000).nullish(),
		startSec: z.number().min(0),
		endSec: z.number().min(0),
		language: z.string().nullish(),
		transcript: z.string().max(200_000).nullish(),
		transcriptLanguage: z.string().nullish(),
		cues: z.array(cueSchema).max(5000).nullish(),
		capturedAt: z.iso.datetime().nullish()
	})
	.refine((m) => m.endSec > m.startSec, { path: ['endSec'], message: 'range' });

export type ClipMetadata = z.infer<typeof metadataSchema>;

export function parseClipMetadata(
	raw: unknown
): { ok: true; metadata: ClipMetadata } | { ok: false; message: string } {
	if (typeof raw !== 'string') return { ok: false, message: 'Faltan los datos del clip.' };

	let json: unknown;
	try {
		json = JSON.parse(raw);
	} catch {
		return { ok: false, message: 'Los datos del clip no se pueden leer.' };
	}

	const result = metadataSchema.safeParse(json);
	if (result.success) return { ok: true, metadata: result.data };

	const issue = result.error.issues[0];
	if (issue.message === 'range') return { ok: false, message: 'El tramo del clip no es válido.' };
	return { ok: false, message: `Los datos del clip no son válidos (${issue.path.join('.')}).` };
}

/**
 * What to store as the clip's text, and whether the local STT has to
 * transcribe it instead. Subtitles are more reliable than the STT, so
 * they're used whenever they're in the audio's language. Otherwise the
 * audio is transcribed and the subtitles, if any, are kept as a translation
 * — e.g. Spanish subs on English audio, or subs on audio whose language is
 * unknown ("und"), which might just as well be a translation.
 */
export function planClipTranscript(metadata: ClipMetadata): {
	language: string | null;
	transcript: string | null;
	cues: ClipCue[];
	translation: { language: string | null; cues: ClipCue[] } | null;
	needsTranscription: boolean;
} {
	const audioLanguage = normalizeIso6392(metadata.language);
	const subtitleLanguage = normalizeIso6392(metadata.transcriptLanguage);
	const duration = metadata.endSec - metadata.startSec;

	const cues = (metadata.cues ?? [])
		.map((cue) => ({
			start: Math.min(cue.start, duration),
			end: Math.min(Math.max(cue.end, cue.start), duration),
			text: cue.text.trim()
		}))
		.filter((cue) => cue.text)
		.sort((a, b) => a.start - b.start);
	const transcript = metadata.transcript?.trim() || cues.map((cue) => cue.text).join('\n');

	// Compared as ISO 639-2, not as Langua's 639-1: two languages Langua
	// doesn't support would both map to null there and look like a match.
	// Subtitles with no language tag get the benefit of the doubt; audio with
	// none doesn't, since there's nothing to check the subtitles against.
	const subtitlesMatchAudio =
		audioLanguage !== null && (subtitleLanguage === null || subtitleLanguage === audioLanguage);

	// Without timings (cues) the text can't follow the audio, so it doesn't count.
	if (cues.length > 0 && transcript && subtitlesMatchAudio) {
		return {
			language: languaLanguageFromIso6392(audioLanguage),
			transcript,
			cues,
			translation: null,
			needsTranscription: false
		};
	}

	return {
		language: languaLanguageFromIso6392(audioLanguage),
		transcript: null,
		cues: [],
		translation:
			cues.length > 0 ? { language: languaLanguageFromIso6392(subtitleLanguage), cues } : null,
		needsTranscription: true
	};
}

/** MP4/M4A files start with a box whose type, at bytes 4-8, is `ftyp`. */
export async function looksLikeMp4(audio: Blob): Promise<boolean> {
	const header = new Uint8Array(await audio.slice(4, 8).arrayBuffer());
	return new TextDecoder().decode(header) === 'ftyp';
}
