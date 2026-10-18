import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createFsStorage } from './fs';
import { RangeNotSatisfiableError, type ObjectStorage } from './types';

let dir: string;
let storage: ObjectStorage;

beforeEach(async () => {
	dir = await mkdtemp(path.join(tmpdir(), 'langua-storage-'));
	storage = createFsStorage(dir);
});

afterEach(async () => {
	await rm(dir, { recursive: true, force: true });
});

async function read(
	storage: ObjectStorage,
	key: string,
	range?: Parameters<ObjectStorage['get']>[1]
) {
	const object = await storage.get(key, range);
	if (!object) return null;
	const text = await new Response(object.body).text();
	return { text, size: object.size, start: object.start, end: object.end };
}

describe('createFsStorage', () => {
	it('stores and returns the whole object', async () => {
		await storage.put('a.m4a', new Blob(['0123456789']));
		expect(await read(storage, 'a.m4a')).toEqual({
			text: '0123456789',
			size: 10,
			start: 0,
			end: 9
		});
	});

	it('creates nested directories and leaves no partial files behind', async () => {
		await storage.put('nested/b.m4a', new Blob(['x']));
		expect(await readdir(path.join(dir, 'nested'))).toEqual(['b.m4a']);
	});

	it('serves byte ranges', async () => {
		await storage.put('a.m4a', new Blob(['0123456789']));
		expect(await read(storage, 'a.m4a', { start: 2, end: 4 })).toMatchObject({
			text: '234',
			start: 2,
			end: 4
		});
		expect(await read(storage, 'a.m4a', { start: 7 })).toMatchObject({ text: '789', end: 9 });
		expect(await read(storage, 'a.m4a', { start: 8, end: 100 })).toMatchObject({
			text: '89',
			end: 9
		});
		expect(await read(storage, 'a.m4a', { suffix: 3 })).toMatchObject({ text: '789', start: 7 });
		expect(await read(storage, 'a.m4a', { suffix: 50 })).toMatchObject({ text: '0123456789' });
	});

	it('rejects ranges it cannot satisfy', async () => {
		await storage.put('a.m4a', new Blob(['0123456789']));
		await expect(storage.get('a.m4a', { start: 10 })).rejects.toBeInstanceOf(
			RangeNotSatisfiableError
		);
		await expect(storage.get('a.m4a', { start: 5, end: 2 })).rejects.toBeInstanceOf(
			RangeNotSatisfiableError
		);
		await expect(storage.get('a.m4a', { suffix: 0 })).rejects.toBeInstanceOf(
			RangeNotSatisfiableError
		);
	});

	it('returns null for missing objects and deletes idempotently', async () => {
		await storage.put('a.m4a', new Blob(['x']));
		await storage.delete('a.m4a');
		expect(await storage.get('a.m4a')).toBeNull();
		await expect(storage.delete('a.m4a')).resolves.toBeUndefined();
	});

	it('refuses keys that could escape its directory', async () => {
		for (const key of ['../x', 'a/../../x', '/etc/passwd', '..', 'a//b']) {
			await expect(storage.put(key, new Blob(['x']))).rejects.toThrow('Invalid storage key');
		}
	});
});
