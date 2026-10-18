/** `bytes=500-999` / `bytes=500-` → { start, end? }; `bytes=-500` (last 500) → { suffix }. */
export type ByteRange = { start: number; end?: number } | { suffix: number };

export type StoredObject = {
	body: ReadableStream<Uint8Array>;
	/** Total size of the object, not just of the returned range. */
	size: number;
	/** First and last byte returned, inclusive — the whole object if no range was asked for. */
	start: number;
	end: number;
};

/**
 * Where clip audio lives. Nothing outside an implementation of this knows
 * whether it's a local directory or (later, maybe) an S3 bucket.
 */
export interface ObjectStorage {
	put(key: string, data: Blob): Promise<void>;
	/** null if there's no such object. Throws RangeNotSatisfiableError for a range past the end. */
	get(key: string, range?: ByteRange): Promise<StoredObject | null>;
	/** No-op if it's already gone. */
	delete(key: string): Promise<void>;
}

export class RangeNotSatisfiableError extends Error {
	constructor(readonly size: number) {
		super('Range not satisfiable');
	}
}
