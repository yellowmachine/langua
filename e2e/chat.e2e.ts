import { expect, test } from '@playwright/test';
import { OPENING, REPLY } from './replies';

test('start a conversation, get the opening message and a streamed reply', async ({ page }) => {
	await page.goto('/chat');
	await expect(page.getByText('Crea una conversación para empezar a practicar.')).toBeVisible();

	await page.getByRole('button', { name: 'Nueva conversación' }).click();
	const dialog = page.getByRole('dialog');
	await dialog.getByLabel('¿De qué quieres hablar? (opcional)').fill('El fin de semana');
	await dialog.getByRole('button', { name: 'Crear' }).click();

	await expect(page).toHaveURL(/\/chat\/[\w-]+$/);
	await expect(page).toHaveTitle('El fin de semana · Langua');

	// Opening message, written in the conversation's language.
	const opening = page.locator('[lang="en"]', { hasText: OPENING });
	await expect(opening).toBeVisible();

	const input = page.getByLabel('Mensaje para el tutor');
	await input.fill('I went to the beach');
	await page.getByRole('button', { name: 'Enviar' }).click();

	await expect(page.getByText('I went to the beach')).toBeVisible();
	await expect(page.locator('[lang="en"]', { hasText: REPLY })).toBeVisible();
	await expect(input).toHaveValue('');

	// Everything was saved: the whole reply, not a partial one. The server
	// stores the reply just after the stream ends, so give it a moment.
	await expect(async () => {
		await page.reload();
		await expect(page.getByText('I went to the beach')).toBeVisible({ timeout: 1000 });
		await expect(page.locator('[lang="en"]', { hasText: REPLY })).toBeVisible({ timeout: 1000 });
	}).toPass({ timeout: 10_000 });
});

test('an unknown conversation is a 404', async ({ page }) => {
	const response = await page.goto('/chat/does-not-exist');
	expect(response?.status()).toBe(404);
});
