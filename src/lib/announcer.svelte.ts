/**
 * One pair of live regions for the whole app (rendered in the root layout),
 * so a message can be announced to screen readers from anywhere — results
 * that appear after a request, a finished chat reply, an error — without
 * every component keeping its own aria-live element mounted beforehand.
 */
class Announcer {
	polite = $state('');
	assertive = $state('');

	/** Read out when the screen reader is idle (results, progress). */
	say(message: string) {
		this.#set('polite', message);
	}

	/** Interrupts whatever is being read (errors). */
	alert(message: string) {
		this.#set('assertive', message);
	}

	#set(kind: 'polite' | 'assertive', message: string) {
		// Clearing first makes the same message be announced again.
		this[kind] = '';
		queueMicrotask(() => (this[kind] = message));
	}
}

export const announcer = new Announcer();
