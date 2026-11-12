import type { Attachment } from 'svelte/attachments';

const NEXT = new Set(['ArrowRight', 'ArrowDown']);
const PREVIOUS = new Set(['ArrowLeft', 'ArrowUp']);

/**
 * One Tab stop for a run of clickable words (`[data-word]` buttons) instead
 * of one per word: Tab enters at the last word used, the arrow keys (and
 * Home/End) move between words, Enter/Space looks one up. Words added later
 * (a reply still streaming in) join the group.
 */
export const rovingFocus: Attachment<HTMLElement> = (node) => {
	const words = () => [...node.querySelectorAll<HTMLElement>('[data-word]')];

	function makeCurrent(target: HTMLElement | undefined, list = words()) {
		if (!target) return;
		for (const word of list) word.tabIndex = word === target ? 0 : -1;
	}

	function sync() {
		const list = words();
		makeCurrent(list.find((word) => word.tabIndex === 0) ?? list[0], list);
	}

	function onKeydown(event: KeyboardEvent) {
		const list = words();
		const index = list.indexOf(event.target as HTMLElement);
		if (index === -1) return;

		let next: number;
		if (NEXT.has(event.key)) next = Math.min(index + 1, list.length - 1);
		else if (PREVIOUS.has(event.key)) next = Math.max(index - 1, 0);
		else if (event.key === 'Home') next = 0;
		else if (event.key === 'End') next = list.length - 1;
		else return;

		event.preventDefault();
		makeCurrent(list[next], list);
		list[next].focus();
	}

	function onFocusin(event: FocusEvent) {
		const target = event.target as HTMLElement;
		if (target.matches('[data-word]')) makeCurrent(target);
	}

	sync();
	const observer = new MutationObserver(sync);
	observer.observe(node, { childList: true, subtree: true });
	node.addEventListener('keydown', onKeydown);
	node.addEventListener('focusin', onFocusin);

	return () => {
		observer.disconnect();
		node.removeEventListener('keydown', onKeydown);
		node.removeEventListener('focusin', onFocusin);
	};
};
