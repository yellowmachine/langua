import { expect, test } from '@playwright/test';

test('look back at a past listening exercise', async ({ page }) => {
	await page.goto('/listen');
	await page.getByRole('link', { name: /50\/100/ }).click();
	await expect(page).toHaveTitle('Ejercicio de escucha · Langua');
	await expect(page.getByText('Tom buys bread every morning.')).toBeVisible();
	await expect(page.getByText('✓ tu respuesta, correcta')).toBeVisible();
	await expect(page.getByText('✗ tu respuesta')).toBeVisible();
	await expect(page.getByText('✓ correcta', { exact: true })).toBeVisible();

	const missing = await page.goto('/listen/nope');
	expect(missing?.status()).toBe(404);
});
