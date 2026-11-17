import { describe, expect, it, vi } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import type { ExportData } from './export';
import { EXPORT_JSON_NAME, exportZipStream } from './export-zip';
import type { ObjectStorage } from './storage/types';

function clip(id: string) {
	return { id, title: id, audioKey: `${id}.m4a` } as ExportData['clips'][number];
}

const data = {
	app: 'Langua',
	version: 1,
	account: { name: 'A' },
	clips: [clip('clip-1'), clip('clip-gone')]
} as unknown as ExportData;

/** Audio de clip-1 en dos trozos, como un fichero leído a stream; clip-gone no está. */
const storage: ObjectStorage = {
	put: async () => {},
	delete: async () => {},
	get: async (key) => {
		if (key !== 'clip-1.m4a') return null;
		const body = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(new Uint8Array([1, 2, 3]));
				controller.enqueue(new Uint8Array([4, 5]));
				controller.close();
			}
		});
		return { body, size: 5, start: 0, end: 4 };
	}
};

describe('exportZipStream', () => {
	it('zips the audio of each clip and the JSON, saying where each audio is', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const zipped = new Uint8Array(await new Response(exportZipStream(data, storage)).arrayBuffer());
		const files = unzipSync(zipped);

		expect(Object.keys(files).sort()).toEqual(['clips/clip-1.m4a', EXPORT_JSON_NAME]);
		expect([...files['clips/clip-1.m4a']]).toEqual([1, 2, 3, 4, 5]);

		const json = JSON.parse(strFromU8(files[EXPORT_JSON_NAME]));
		expect(json.account).toEqual({ name: 'A' });
		expect(json.clips).toEqual([
			{ id: 'clip-1', title: 'clip-1', audioFile: 'clips/clip-1.m4a' },
			{ id: 'clip-gone', title: 'clip-gone', audioFile: null }
		]);
	});
});
