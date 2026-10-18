import { eq } from 'drizzle-orm';
import { LANGUAGES } from '$lib/languages';
import { transcribeWithSegments } from './ai/stt';
import { clip } from './db/schema';
import type { WithRLS } from './db/rls';
import { clipStorage } from './storage';

// Clips without usable subtitles are transcribed by the local STT after
// /api/v1/clips has already answered: a 10-minute clip can take minutes on
// CPU. One at a time, in memory — the STT container is capped at 1G and
// shares the box with everything else, and there's a single app instance.
//
// Jobs don't survive a restart: such clips stay 'pending' without being
// queued (see isClipTranscriptionQueued), and the clip page offers to retry.
// Each job carries the withRLS of whoever queued it, so this never needs to
// look at clips across users.

type Job = { clipId: string; withRLS: WithRLS };

const queue: Job[] = [];
let current: string | null = null;

export function enqueueClipTranscription(clipId: string, withRLS: WithRLS): void {
	if (isClipTranscriptionQueued(clipId)) return;
	queue.push({ clipId, withRLS });
	void drain();
}

/** Whether this process is transcribing the clip or has it waiting in line. */
export function isClipTranscriptionQueued(clipId: string): boolean {
	return current === clipId || queue.some((job) => job.clipId === clipId);
}

async function drain(): Promise<void> {
	if (current !== null) return;

	for (let job = queue.shift(); job; job = queue.shift()) {
		current = job.clipId;
		try {
			await transcribeClip(job);
		} catch (err) {
			console.error(`Transcription of clip ${job.clipId} failed:`, err);
			await job
				.withRLS((tx) =>
					tx.update(clip).set({ transcriptionStatus: 'failed' }).where(eq(clip.id, job.clipId))
				)
				.catch(() => {});
		} finally {
			current = null;
		}
	}
}

async function transcribeClip({ clipId, withRLS }: Job): Promise<void> {
	const row = await withRLS(async (tx) => {
		const [found] = await tx
			.select({ audioKey: clip.audioKey, audioType: clip.audioType, language: clip.language })
			.from(clip)
			.where(eq(clip.id, clipId));
		return found;
	});
	if (!row) return; // deleted while waiting in line

	const object = await clipStorage.get(row.audioKey);
	if (!object) throw new Error(`Audio ${row.audioKey} is missing`);
	const audio = new Blob([await new Response(object.body).arrayBuffer()], { type: row.audioType });

	const result = await transcribeWithSegments(audio, row.audioKey, row.language);

	// Without a known language whisper detected one; keep it if Langua has it.
	const detected = LANGUAGES.find((lang) => lang.code === result.language)?.code ?? null;

	await withRLS((tx) =>
		tx
			.update(clip)
			.set({
				transcript: result.cues.map((cue) => cue.text).join('\n'),
				cues: result.cues,
				language: row.language ?? detected,
				transcriptionStatus: 'ready'
			})
			.where(eq(clip.id, clipId))
	);
}
