import { error } from '@sveltejs/kit';
import { getExportData } from '$lib/server/export';
import type { RequestHandler } from './$types';

// GET /account/export: todo lo de la cuenta, como JSON descargable.
export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) error(401, 'Not authenticated');

	const data = await getExportData(locals.withRLS, locals.user.id);
	const date = new Date().toISOString().slice(0, 10);
	return new Response(JSON.stringify(data, null, 2), {
		headers: {
			'Content-Type': 'application/json; charset=utf-8',
			'Content-Disposition': `attachment; filename="langua-${date}.json"`,
			'Cache-Control': 'no-store'
		}
	});
};
