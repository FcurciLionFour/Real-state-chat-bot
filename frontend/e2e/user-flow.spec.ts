import { expect, test } from '@playwright/test';

test('flujo principal de usuario: registro, chat, resultados, favoritos y rehidratacion', async ({
  page,
}) => {
  const email = `pw-user-${Date.now()}@local.test`;
  const password = 'StrongPassword123';

  await page.goto('/register');
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('input[name="confirmPassword"]').fill(password);
  await page.getByRole('button', { name: 'Crear cuenta' }).click();

  await expect(page).toHaveURL(/\/search$/);
  await expect(page.getByRole('heading', { name: /Asistente inmobiliario/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Contame qué estás buscando/i })).toBeVisible();
  await expect(page.locator('textarea[name="message"]')).toBeVisible();

  await page.locator('textarea[name="message"]').fill(
    'Quiero comprar un monoambiente en Palermo con balcon hasta 140000 USD',
  );
  await page.getByRole('button', { name: 'Enviar mensaje' }).click();

  await expect(page).toHaveURL(/\/app\/chats\/.+/, { timeout: 15_000 });
  await expect(page.locator('.conversation-item').first()).toBeVisible();

  const assistantMessage = page.locator('.message-card--assistant .message-card__content').last();
  await expect(assistantMessage).not.toBeEmpty({
    timeout: 45_000,
  });

  await expect(page.locator('.results-flow')).toBeVisible({ timeout: 45_000 });
  await expect(page.locator('.result-card').first()).toBeVisible();

  await page.getByRole('button', { name: /Guardar favorito/i }).first().click();
  await page.getByRole('link', { name: 'Favoritos' }).click();

  await expect(page).toHaveURL(/\/app\/favorites$/);
  await expect(page.locator('.favorite-card').first()).toBeVisible();

  await page.getByRole('link', { name: 'Chats' }).click();
  await expect(page).toHaveURL(/\/app\/chats\/.+/);
  await expect(page.locator('.results-flow')).toBeVisible();
  await expect(page.locator('.conversation-item__summary').first()).not.toContainText(/Sin lectura operativa/i);
});
