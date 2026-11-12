import { expect, test } from '@playwright/test';

test('progress counts every kind of practice, also as a table', async ({ page }) => {
	await page.goto('/progress');
	await expect(page).toHaveTitle('Progreso · Langua');
	for (const label of [
		'Mensajes de chat',
		'Ejercicios de escucha',
		'Frases dichas',
		'Palabras repasadas',
		'Palabras nuevas'
	]) {
		await expect(page.getByRole('heading', { name: label })).toBeVisible();
	}
	// The seeded study words were created today.
	await page.getByText('Ver como tabla').click();
	const table = page.getByRole('table', { name: 'Actividad por día, últimos 14 días' });
	await expect(table.getByRole('row')).toHaveCount(15);
	await expect(table.getByText(/Palabras nuevas: \d+/).first()).toBeVisible();
});
