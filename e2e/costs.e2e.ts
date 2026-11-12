import { expect, test } from '@playwright/test';

test('what the AI cost, by action, week and month', async ({ page }) => {
	// Calls priced by the fake Seilide: a chat (greeting + streamed reply) and a sentence.
	await page.goto('/chat');
	await page.getByRole('button', { name: /Nueva/ }).first().click();
	await page.getByRole('dialog').getByRole('button', { name: 'Crear' }).click();
	await expect(page).toHaveURL(/\/chat\/[\w-]+$/);
	await page.getByLabel('Mensaje para el tutor').fill('Hello');
	await page.getByRole('button', { name: 'Enviar' }).click();
	await expect(page.getByLabel('Mensaje para el tutor')).toBeEnabled();

	await page.goto('/speak');
	await page.getByRole('button', { name: 'Nueva frase' }).click();
	await expect(page.getByRole('region', { name: 'Frase para repetir' })).toBeVisible();

	await page.getByRole('link', { name: 'Gasto en IA' }).first().click();
	await expect(page).toHaveTitle('Gasto en IA · Langua');

	const byTask = page.getByRole('table', { name: /Gasto por tipo de acción, Este mes/ });
	await expect(byTask.getByRole('row', { name: /Frases para repetir/ })).toContainText('0,0001');
	await expect(byTask.getByRole('row', { name: /Voz \(lectura en voz alta\)/ })).toContainText(
		'no disponible'
	);
	await expect(byTask.getByText('120 caracteres leídos')).toBeVisible();

	// A streamed reply is priced from the stream's last event, noted just
	// after the stream ends: give it a moment.
	await expect(async () => {
		await page.reload();
		await expect(byTask.getByRole('row', { name: /Respuestas del tutor/ })).toContainText(
			/0,000[1-9]/,
			{ timeout: 1000 }
		);
	}).toPass({ timeout: 10_000 });
	await expect(byTask.getByRole('row', { name: /Saludo de una conversación/ })).toBeVisible();

	// The 45-day-old reply only counts over a longer period.
	await page.getByRole('button', { name: 'Desde el principio' }).click();
	await expect(page).toHaveURL(/periodo=all/);
	const allTime = page.getByRole('table', { name: /Desde el principio/ });
	await expect(allTime.getByRole('row', { name: /Respuestas del tutor/ })).toContainText('0,25');

	await expect(page.getByRole('table', { name: 'Gasto por mes, últimos 12 meses' })).toBeVisible();
	await expect(page.getByText(/La voz llega sin su coste/)).toBeVisible();
});
