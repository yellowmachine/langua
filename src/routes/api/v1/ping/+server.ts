import { json } from '@sveltejs/kit';
import { authenticateBearer } from '$lib/server/api-auth';
import type { RequestHandler } from './$types';

// Lets an integration check its token without sending anything.
export const GET: RequestHandler = async ({ request }) => {
	await authenticateBearer(request);
	return json({ ok: true });
};
