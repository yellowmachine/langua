import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { clip } from '$lib/server/db/schema';
import { parseRangeHeader } from '$lib/server/http-range';
import { clipStorage, RangeNotSatisfiableError } from '$lib/server/storage';
import type { RequestHandler } from './$types';

// The clip's audio, only for its owner (the RLS lookup below is what
// enforces that), with byte ranges so the player can seek.
export const GET: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user) error(401, 'Unauthorized');

	const row = await locals.withRLS(async (tx) => {
		const [found] = await tx
			.select({ audioKey: clip.audioKey, audioType: clip.audioType })
			.from(clip)
			.where(eq(clip.id, params.id));
		return found;
	});
	if (!row) error(404, 'Clip not found');

	const range = parseRangeHeader(request.headers.get('range'));

	let object;
	try {
		object = await clipStorage.get(row.audioKey, range ?? undefined);
	} catch (err) {
		if (err instanceof RangeNotSatisfiableError) {
			return new Response(null, {
				status: 416,
				headers: { 'Content-Range': `bytes */${err.size}` }
			});
		}
		throw err;
	}
	if (!object) error(404, 'Audio not found');

	const headers: Record<string, string> = {
		'Content-Type': row.audioType,
		'Content-Length': String(object.end - object.start + 1),
		'Accept-Ranges': 'bytes',
		// A clip's audio never changes once stored.
		'Cache-Control': 'private, max-age=31536000, immutable'
	};
	if (range) headers['Content-Range'] = `bytes ${object.start}-${object.end}/${object.size}`;

	return new Response(object.body, { status: range ? 206 : 200, headers });
};
