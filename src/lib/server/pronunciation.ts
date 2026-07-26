const DIACRITICS = /[̀-ͯ]/g;

function normalize(text: string): string {
	return text
		.toLowerCase()
		.normalize('NFD')
		.replace(DIACRITICS, '') // strip diacritics, STT often drops them
		.replace(/[^\p{L}\p{N}\s]/gu, '') // strip punctuation
		.trim()
		.replace(/\s+/g, ' ');
}

function levenshtein(a: string, b: string): number {
	const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
		new Array(b.length + 1).fill(0)
	);
	for (let i = 0; i <= a.length; i++) dp[i][0] = i;
	for (let j = 0; j <= b.length; j++) dp[0][j] = j;

	for (let i = 1; i <= a.length; i++) {
		for (let j = 1; j <= b.length; j++) {
			dp[i][j] =
				a[i - 1] === b[j - 1]
					? dp[i - 1][j - 1]
					: 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
		}
	}

	return dp[a.length][b.length];
}

/** 0-100: how close the transcript is to the target phrase, char-level. */
export function scorePronunciation(target: string, transcript: string): number {
	const a = normalize(target);
	const b = normalize(transcript);
	if (!a) return 0;

	const distance = levenshtein(a, b);
	const maxLength = Math.max(a.length, b.length, 1);
	return Math.max(0, Math.round((1 - distance / maxLength) * 100));
}
