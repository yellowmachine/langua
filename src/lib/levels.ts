export const LEVELS = [
	{ code: 'beginner', label: 'Principiante' },
	{ code: 'intermediate', label: 'Intermedio' },
	{ code: 'advanced', label: 'Avanzado' }
] as const;

export function levelInstruction(level: string | null): string {
	switch (level) {
		case 'advanced':
			return "The learner is at an advanced level: speak naturally, use varied vocabulary and idiomatic expressions, and don't simplify unnecessarily.";
		case 'intermediate':
			return 'The learner is at an intermediate level: use natural sentences and moderately varied vocabulary, but avoid obscure idioms or very complex grammar.';
		default:
			return 'The learner is a beginner: use short, simple sentences, basic vocabulary, and avoid complex grammar or idioms.';
	}
}
