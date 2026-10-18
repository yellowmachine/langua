import { describe, expect, it } from 'vitest';
import { languaLanguageFromIso6392, normalizeIso6392 } from './iso639';

describe('languaLanguageFromIso6392', () => {
	it('maps both bibliographic and terminology codes', () => {
		expect(languaLanguageFromIso6392('eng')).toBe('en');
		expect(languaLanguageFromIso6392('spa')).toBe('es');
		expect(languaLanguageFromIso6392('fre')).toBe('fr');
		expect(languaLanguageFromIso6392('fra')).toBe('fr');
		expect(languaLanguageFromIso6392('ger')).toBe('de');
		expect(languaLanguageFromIso6392('deu')).toBe('de');
		expect(languaLanguageFromIso6392('ita')).toBe('it');
		expect(languaLanguageFromIso6392('por')).toBe('pt');
		expect(languaLanguageFromIso6392(' ENG ')).toBe('en');
	});

	it('returns null for undetermined, unsupported or malformed codes', () => {
		for (const code of ['und', 'mul', 'jpn', 'dut', 'en', '', null, undefined]) {
			expect(languaLanguageFromIso6392(code)).toBeNull();
		}
	});
});

describe('normalizeIso6392', () => {
	it('folds B/T variants together so they compare equal', () => {
		expect(normalizeIso6392('ger')).toBe(normalizeIso6392('deu'));
		expect(normalizeIso6392('chi')).toBe('zho');
		expect(normalizeIso6392('jpn')).toBe('jpn');
		expect(normalizeIso6392('und')).toBeNull();
	});
});
