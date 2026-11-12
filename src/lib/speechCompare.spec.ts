import { describe, expect, it } from 'vitest';
import { compareSpeech } from './speechCompare';

describe('compareSpeech', () => {
	it('is perfect when every word was said, whatever the punctuation and case', () => {
		const result = compareSpeech('¿Qué hora es?', 'que hora es');
		expect(result.score).toBe(100);
		expect(result.words.map((w) => [w.text, w.said])).toEqual([
			['¿Qué', true],
			['hora', true],
			['es?', true]
		]);
		expect(result.extra).toEqual([]);
	});

	it('marks the words left out, keeping their spelling', () => {
		const result = compareSpeech('I would like a coffee, please.', 'I like a coffee');
		expect(result.words.filter((w) => !w.said).map((w) => w.text)).toEqual(['would', 'please.']);
		expect(result.score).toBe(67);
	});

	it('lists words added and counts them against the score', () => {
		const result = compareSpeech('Je suis content', 'je suis très content');
		expect(result.extra).toEqual(['très']);
		expect(result.words.every((w) => w.said)).toBe(true);
		expect(result.score).toBe(75);
	});

	it('handles a wrong word as one missing and one extra', () => {
		const result = compareSpeech('the red car', 'the blue car');
		expect(result.words.map((w) => w.said)).toEqual([true, false, true]);
		expect(result.extra).toEqual(['blue']);
		expect(result.score).toBe(50);
	});

	it('scores nothing said as zero', () => {
		expect(compareSpeech('Hola', '').score).toBe(0);
	});
});
