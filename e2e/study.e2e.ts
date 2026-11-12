import { expect, test } from '@playwright/test';

test('review the due words with flashcards', async ({ page }) => {
	await page.goto('/study');
	await page.getByRole('link', { name: 'Repasar (2 pendientes)' }).click();
	await expect(page).toHaveTitle('Repasar · Langua');

	for (let i = 0; i < 2; i++) {
		const card = page.getByRole('region', { name: 'Tarjeta' });
		await expect(card.getByText('Nueva')).toBeVisible();
		await page.getByRole('button', { name: 'Mostrar respuesta' }).click();
		await expect(card.getByText(/^(gato|perro)$/)).toBeVisible();
		// «Fácil» sends a new word days ahead; «Bien» would bring it back in
		// minutes, in this same session (FSRS learning step).
		await page.getByRole('button', { name: /^Fácil/ }).click();
	}

	await expect(page.getByText('¡Hecho! Has repasado 2 palabras.')).toBeVisible();

	// They aren't due any more.
	await page.goto('/study');
	await expect(page.getByRole('link', { name: 'Repasar', exact: true })).toBeVisible();
});

test('edit and delete a word', async ({ page }) => {
	await page.goto('/study');
	await page.getByRole('button', { name: 'Editar «cat»' }).click();
	await page.getByLabel('Traducción').fill('gato, minino');
	await page.getByRole('button', { name: 'Guardar' }).click();
	await expect(page.getByText('— gato, minino')).toBeVisible();

	page.once('dialog', (dialog) => dialog.accept());
	await page.getByRole('button', { name: 'Borrar «dog»' }).click();
	await expect(page.getByText('— perro')).toHaveCount(0);
	await page.reload();
	await expect(page.getByText('— perro')).toHaveCount(0);
	await expect(page.getByText('— gato, minino')).toBeVisible();
});
