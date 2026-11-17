import { error } from '@sveltejs/kit';
import { exportJson, getExportData } from '$lib/server/export';
import { exportZipStream } from '$lib/server/export-zip';
import { clipStorage } from '$lib/server/storage';
import type { RequestHandler } from './$types';

// GET /account/export: todo lo de la cuenta en un ZIP con el audio de los
// clips; ?format=json, solo los datos.
export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user) error(401, 'Not authenticated');

	const format = url.searchParams.get('format') ?? 'zip';
	if (format !== 'zip' && format !== 'json') error(400, 'format must be zip or json');

	const data = await getExportData(locals.withRLS, locals.user.id);
	const date = new Date().toISOString().slice(0, 10);
	const headers = (type: string, ext: string) => ({
		'Content-Type': type,
		'Content-Disposition': `attachment; filename="langua-${date}.${ext}"`,
		'Cache-Control': 'no-store'
	});

	if (format === 'json') {
		return new Response(exportJson(data), {
			headers: headers('application/json; charset=utf-8', 'json')
		});
	}
	return new Response(exportZipStream(data, clipStorage), {
		headers: headers('application/zip', 'zip')
	});
};
