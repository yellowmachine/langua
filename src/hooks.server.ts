import { error, text, type Handle, type HandleServerError } from '@sveltejs/kit';
import { APICallError, RetryError } from 'ai';
import { sequence } from '@sveltejs/kit/hooks';
import { building, dev } from '$app/environment';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { auth } from '$lib/server/auth';
import { withUserRLS } from '$lib/server/db/rls';

const FORM_CONTENT_TYPES = [
	'application/x-www-form-urlencoded',
	'multipart/form-data',
	'text/plain',
	'application/x-sveltekit-formdata'
];

// Same as SvelteKit's own CSRF origin check (disabled in svelte.config.js),
// except for /api/v1: those routes only accept bearer tokens, never the
// session cookie, so a cross-site form can't act as the user there.
const handleCsrf: Handle = ({ event, resolve }) => {
	const { request, url } = event;
	const contentType = request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase();

	const forbidden =
		!dev &&
		!url.pathname.startsWith('/api/v1/') &&
		['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method) &&
		contentType !== undefined &&
		FORM_CONTENT_TYPES.includes(contentType) &&
		request.headers.get('origin') !== url.origin;

	if (forbidden) {
		return text(`Cross-site ${request.method} form submissions are forbidden`, { status: 403 });
	}

	return resolve(event);
};

const handleSession: Handle = async ({ event, resolve }) => {
	if (!building) {
		const result = await auth.api.getSession({ headers: event.request.headers });
		event.locals.session = result?.session ?? null;
		event.locals.user = result?.user ?? null;
	}

	return resolve(event);
};

// Any query for per-user content (chat, progress, etc.) should go through
// `locals.withRLS` instead of the plain `db` import — see withUserRLS.
const handleRLS: Handle = ({ event, resolve }) => {
	const userId = event.locals.user?.id;

	event.locals.withRLS = (fn) => {
		if (!userId) error(401, 'Unauthorized');
		return withUserRLS(userId, fn);
	};

	return resolve(event);
};

const handleBetterAuth: Handle = ({ event, resolve }) => {
	return svelteKitHandler({ event, resolve, auth, building });
};

export const handle: Handle = sequence(handleCsrf, handleSession, handleRLS, handleBetterAuth);

// Seilide's AI endpoint answers 401/402/403/502 with a short Spanish message
// meant for the person (no credit left, the family has no OpenRouter key…),
// so pass it on instead of SvelteKit's generic "Internal Error".
export const handleError: HandleServerError = ({ error }) => {
	// 502 is retried by the AI SDK, which then wraps the last attempt.
	const cause = RetryError.isInstance(error) ? error.lastError : error;
	if (APICallError.isInstance(cause) && SEILIDE_AI_ERRORS.includes(cause.statusCode ?? 0)) {
		return { message: cause.message };
	}
};

const SEILIDE_AI_ERRORS = [401, 402, 403, 502];
