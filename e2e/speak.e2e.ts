import { expect, test } from '@playwright/test';
import { SPEAKING_SENTENCE, SPEAKING_TRANSLATION } from './replies';

test('repeat a sentence aloud and get it scored word by word', async ({ page }) => {
	await page.goto('/speak');
	await page.getByLabel('Tema (opcional)').fill('En una cafetería');
	await page.getByRole('button', { name: 'Nueva frase' }).click();

	const sentence = page.getByRole('region', { name: 'Frase para repetir' });
	await expect(sentence.getByText(SPEAKING_SENTENCE)).toBeVisible();
	await expect(sentence.getByText(SPEAKING_TRANSLATION)).toBeVisible();

	await page.getByRole('button', { name: 'Grabar mensaje de voz' }).click();
	await page.waitForTimeout(500);
	await page.getByRole('button', { name: 'Detener grabación' }).click();

	// The fake STT hears «I like a coffee please»: «would» is missing.
	const result = page.getByRole('region', { name: 'Resultado' });
	await expect(result.getByText('83')).toBeVisible();
	await expect(result.locator('.line-through')).toHaveText([/^would\s*\(no dicha\)$/]);

	await page.reload();
	await expect(page.getByText('83/100')).toBeVisible();
});
