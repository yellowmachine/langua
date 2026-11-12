import { createFocusTrap } from 'focus-trap';
import type { Attachment } from 'svelte/attachments';

/** Tailwind's `sm` breakpoint: below it the side panels become drawers. */
const PHONE = '(max-width: 639.98px)';

/**
 * Makes a side panel behave as a modal drawer while it is open on a phone:
 * focus moves into it and stays there, Escape or a click outside closes it,
 * and focus goes back to whatever opened it. On wider screens the panel is
 * a static column, so nothing happens.
 *
 * `{@attach drawer(open, onclose, 'Palabra')}`
 */
export function drawer(open: boolean, onclose: () => void, label: string): Attachment<HTMLElement> {
	return (node) => {
		if (!open || !window.matchMedia(PHONE).matches) return;

		node.setAttribute('role', 'dialog');
		node.setAttribute('aria-modal', 'true');
		node.setAttribute('aria-label', label);

		const trap = createFocusTrap(node, {
			fallbackFocus: node,
			escapeDeactivates: true,
			clickOutsideDeactivates: true,
			returnFocusOnDeactivate: true,
			// Escape / outside click: tell the owner, which flips `open` and
			// runs the cleanup below.
			onDeactivate: onclose
		});
		trap.activate();

		return () => {
			// Closed by the owner (close button): don't call onclose again.
			trap.deactivate({ onDeactivate: () => {} });
			node.removeAttribute('role');
			node.removeAttribute('aria-modal');
			node.removeAttribute('aria-label');
		};
	};
}
