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
 * (re)transcribe it instead: when there are no subtitles, or they're in a
 * different language than the audio (e.g. Spanish subs on English audio).
 */
export function planClipTranscript(metadata: ClipMetadata): {
	language: string | null;
	transcript: string | null;
	cues: ClipCue[];
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

	// If either side's language is unknown we can't tell they differ, so the
	// subtitles get the benefit of the doubt (and lend the audio their language).
	const subtitlesUsable =
		cues.length > 0 &&
		Boolean(transcript) &&
		(!audioLanguage || !subtitleLanguage || audioLanguage === subtitleLanguage);

	if (!subtitlesUsable) {
		return {
			language: languaLanguageFromIso6392(audioLanguage),
			transcript: null,
			cues: [],
			needsTranscription: true
		};
	}

	return {
		language: languaLanguageFromIso6392(audioLanguage ?? subtitleLanguage),
		transcript,
		cues,
		needsTranscription: false
	};
}

/** MP4/M4A files start with a box whose type, at bytes 4-8, is `ftyp`. */
export async function looksLikeMp4(audio: Blob): Promise<boolean> {
	const header = new Uint8Array(await audio.slice(4, 8).arrayBuffer());
	return new TextDecoder().decode(header) === 'ftyp';
}
