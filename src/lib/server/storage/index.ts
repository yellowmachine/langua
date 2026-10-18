import { env } from '$env/dynamic/private';
import { createFsStorage } from './fs';

export type { ByteRange, ObjectStorage, StoredObject } from './types';
export { RangeNotSatisfiableError } from './types';

// Audio of clips sent in by integrations (see /api/v1/clips). A volume in
// docker-compose.prod.yml; swap in an S3-backed ObjectStorage here if that
// ever stops being enough.
export const clipStorage = createFsStorage(env.CLIPS_DIR ?? './data/clips');
