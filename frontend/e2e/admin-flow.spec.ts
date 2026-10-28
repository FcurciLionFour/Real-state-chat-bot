import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { expect, test } from '@playwright/test';

test('flujo admin: promocion local y acceso al panel', async ({ page }) => {
  const email = `pw-admin-${Date.now()}@local.test`;
  const password = 'StrongPassword123';
  const promoteScriptPath = path.resolve(__dirname, '../../backend/test/helpers/promote-user-admin.js');

  await page.goto('/register');
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('input[name="confirmPassword"]').fill(password);
  await page.getByRole('button', { name: 'Crear cuenta' }).click();

  await expect(page).toHaveURL(/\/search$/);

  execFileSync('node', [promoteScriptPath, email], {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'pipe',
  });

  await page.getByRole('button', { name: 'Salir' }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole('button', { name: 'Ingresar' }).click();

  await expect(page).toHaveURL(/\/search$/);
  await expect(page.getByRole('link', { name: 'Admin' })).toBeVisible();

  await page.getByRole('link', { name: 'Admin' }).click();
  await expect(page).toHaveURL(/\/app\/admin$/);
  await expect(page.getByRole('heading', { name: /Operacion del MVP/i })).toBeVisible();
  await expect(page.getByText('Actualizar panel')).toBeVisible();
  await expect(page.locator('.metric-card').first()).toBeVisible();

  await page.getByRole('button', { name: 'Invalidar cache' }).click();
  await expect(page.locator('.admin-state--success').first()).toContainText(
    /Redis no estaba disponible|Cache operativo invalidado/i,
  );

  await page.getByRole('button', { name: 'Conversaciones' }).click();
  await expect(page.getByRole('heading', { name: 'Conversaciones recientes' })).toBeVisible();

  await page.getByRole('button', { name: 'Search runs' }).click();
  await expect(page.getByRole('heading', { name: 'Search runs recientes' })).toBeVisible();
});
