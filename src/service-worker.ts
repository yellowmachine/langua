/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />
/// <reference types="@sveltejs/kit" />

import { build, files, version } from '$service-worker';

const worker = self as unknown as ServiceWorkerGlobalScope;

const CACHE = `langua-${version}`;
const ASSETS = [...build, ...files];

worker.addEventListener('install', (event) => {
	async function addFilesToCache() {
		const cache = await caches.open(CACHE);
		await cache.addAll(ASSETS);
	}
	event.waitUntil(addFilesToCache());
});

worker.addEventListener('activate', (event) => {
	async function deleteOldCaches() {
		for (const key of await caches.keys()) {
			if (key !== CACHE) await caches.delete(key);
		}
	}
	event.waitUntil(deleteOldCaches());
});

// Only serve precached build/static assets from cache. Everything else
// (pages, API calls) goes straight to the network — this app is dynamic and
// per-user, so we don't want stale HTML or data served while offline.
worker.addEventListener('fetch', (event) => {
	if (event.request.method !== 'GET') return;

	const url = new URL(event.request.url);
	if (!ASSETS.includes(url.pathname)) return;

	event.respondWith(
		(async () => {
			const cache = await caches.open(CACHE);
			const cached = await cache.match(url.pathname);
			return cached ?? fetch(event.request);
		})()
	);
});
