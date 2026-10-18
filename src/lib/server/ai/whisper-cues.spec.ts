import { describe, expect, it } from 'vitest';
import { cuesFromWhisperSegment } from './whisper-cues';

const w = (start: number, end: number, word: string) => ({ start, end, word });

describe('cuesFromWhisperSegment', () => {
	it('splits a segment into sentences timed by their words', () => {
		expect(
			cuesFromWhisperSegment({
				start: 0,
				end: 5,
				text: ' How you doing? I am fine. Pivot!',
				words: [
					w(0, 0.16, ' How'),
					w(0.16, 0.3, ' you'),
					w(0.3, 0.56, ' doing?'),
					w(0.92, 1.0, ' I'),
					w(1.0, 1.1, ' am'),
					w(1.1, 1.42, ' fine.'),
					w(2.32, 2.58, ' Pivot!')
				]
			})
		).toEqual([
			{ start: 0, end: 0.56, text: 'How you doing?' },
			{ start: 0.92, end: 1.42, text: 'I am fine.' },
			{ start: 2.32, end: 2.58, text: 'Pivot!' }
		]);
	});

	it('handles closing quotes, ellipses and an unterminated last sentence', () => {
		expect(
			cuesFromWhisperSegment({
				start: 0,
				end: 4,
				text: '',
				words: [w(0, 1, ' «Hola.»'), w(1, 2, ' Espera…'), w(2, 3, ' y'), w(3, 4, ' luego')]
			}).map((cue) => cue.text)
		).toEqual(['«Hola.»', 'Espera…', 'y luego']);
	});

	it('falls back to the segment itself without word timestamps', () => {
		expect(cuesFromWhisperSegment({ start: 1, end: 2, text: ' Hi. ', words: null })).toEqual([
			{ start: 1, end: 2, text: 'Hi.' }
		]);
		expect(cuesFromWhisperSegment({ start: 1, end: 2, text: '  ' })).toEqual([]);
	});
});
