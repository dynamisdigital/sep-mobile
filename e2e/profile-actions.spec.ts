import { expect, test, type Page } from '@playwright/test';

async function enableMsw(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem('NG_APP_USE_MSW', 'true');
  });
}

async function loginCliente(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel(/e-?mail/i).fill('cliente@empresa.com');
  await page.getByLabel(/^senha/i).fill('senha-passphrase-segura');
  await page.getByRole('button', { name: /entrar|login/i }).click();
  await expect(page).toHaveURL(/\/app\/inicio$/, { timeout: 10_000 });
}

test.describe('Perfil - acoes clicaveis', () => {
  test.beforeEach(async ({ page }) => {
    await enableMsw(page);
    await loginCliente(page);
    await page.goto('/app/perfil');
    await expect(page.getByTestId('sep-profile-email')).toContainText('cliente@empresa.com');
  });

  test('botoes do perfil e sair do header recebem clique', async ({ page }) => {
    await page.getByTestId('sep-profile-change-password').click();
    await expect(page).toHaveURL(/\/app\/perfil\/alterar-senha$/);

    await page.goto('/app/perfil');
    await page.getByTestId('sep-profile-reload').click();
    await expect(page.getByTestId('sep-profile-email')).toContainText('cliente@empresa.com');

    await page.getByTestId('sep-profile-logout').click();
    await expect(page).toHaveURL(/\/welcome$/, { timeout: 10_000 });

    await loginCliente(page);
    await page.goto('/app/perfil');
    await page.getByTestId('sep-header-mobile-logout').click();
    await expect(page).toHaveURL(/\/welcome$/, { timeout: 10_000 });
  });
});
