import { expect, test, type Page } from '@playwright/test';

// MSW eh ativado via localStorage flag NG_APP_USE_MSW antes do bootstrap.
async function enableMsw(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem('NG_APP_USE_MSW', 'true');
  });
}

test.describe('M-Sprint 2 - telas publicas', () => {
  test.beforeEach(async ({ page }) => {
    await enableMsw(page);
  });

  test('app abre e splash redireciona para /welcome', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('ion-app')).toBeVisible();
    await page.waitForURL('**/welcome', { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: /Credito empresarial/i })).toBeVisible();
  });

  test('welcome navega para /login', async ({ page }) => {
    await page.goto('/welcome');
    await page.locator('.sep-welcome__cta-primary').click();
    await page.waitForURL('**/login');
    await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
  });

  test('welcome navega para /register', async ({ page }) => {
    await page.goto('/welcome');
    await page.locator('.sep-welcome__cta-secondary').click();
    await page.waitForURL('**/register');
    await expect(page.getByRole('heading', { name: 'Criar conta' })).toBeVisible();
  });
});
