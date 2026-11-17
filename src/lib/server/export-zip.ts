import { Zip, ZipDeflate, ZipPassThrough, strToU8 } from 'fflate';
import type { ExportData } from './export';
import type { ObjectStorage } from './storage/types';

// La exportación completa: el JSON de getExportData y el audio de cada clip,
// en un ZIP que se genera mientras se descarga (cada audio se lee a trozos,
// sin cargarlo entero en memoria). El audio va sin comprimir (ya lo está).
// El JSON va al final, para que cada clip diga en `audioFile` dónde está su
// audio en el ZIP, o null si el fichero no estaba.

export const EXPORT_JSON_NAME = 'langua.json';

/** Dónde va el audio de un clip dentro del ZIP: clips/<clave>. */
function audioPath(audioKey: string): string {
	return `clips/${audioKey.split('/').pop()}`;
}

async function* zipChunks(data: ExportData, storage: ObjectStorage) {
	const queue: Uint8Array[] = [];
	let failure: unknown = null;
	const zip = new Zip((err, chunk) => {
		if (err) failure = err;
		else queue.push(chunk);
	});
	function* drain() {
		if (failure) throw failure;
		while (queue.length) yield queue.shift()!;
	}

	const clips = [];
	for (const { audioKey, ...clip } of data.clips) {
		const object = await storage.get(audioKey);
		if (!object) {
			console.error(`[export] clip audio ${audioKey} is missing`);
			clips.push({ ...clip, audioFile: null });
			continue;
		}
		const path = audioPath(audioKey);
		const entry = new ZipPassThrough(path);
		zip.add(entry);
		for await (const chunk of object.body) {
			entry.push(chunk);
			yield* drain();
		}
		entry.push(new Uint8Array(0), true);
		yield* drain();
		clips.push({ ...clip, audioFile: path });
	}

	const json = new ZipDeflate(EXPORT_JSON_NAME, { level: 6 });
	zip.add(json);
	json.push(strToU8(JSON.stringify({ ...data, clips }, null, 2)), true);
	zip.end();
	yield* drain();
}

/** El ZIP como stream, listo para el cuerpo de una Response. */
export function exportZipStream(
	data: ExportData,
	storage: ObjectStorage
): ReadableStream<Uint8Array> {
	const chunks = zipChunks(data, storage);
	return new ReadableStream({
		async pull(controller) {
			try {
				const { value, done } = await chunks.next();
				if (done) controller.close();
				else controller.enqueue(value);
			} catch (err) {
				console.error('[export] building the ZIP failed:', err);
				controller.error(err);
			}
		},
		async cancel() {
			await chunks.return(undefined);
		}
	});
}
