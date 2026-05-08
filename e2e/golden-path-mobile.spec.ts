import { expect, test } from '@playwright/test';

import { changedPassword, defaultPassword, uniqueEmail } from './fixtures/users';

test.describe('Golden path mobile - cadastro, login, perfil, alterar senha, logout, relogin', () => {
  test('CLIENTE conclui golden path autenticado', async ({ page }) => {
    const email = uniqueEmail('m4-cliente');

    // 1. Splash redireciona para /welcome quando nao ha sessao
    await page.goto('/');
    await expect(page).toHaveURL(/\/welcome$/);

    // 2. Ir para cadastro
    await page
      .getByRole('link', { name: /cadastr/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/register$/);

    // 3. Criar usuario CLIENTE
    await page.getByLabel(/e-?mail/i).fill(email);
    await page.getByLabel(/^senha/i).fill(defaultPassword);
    await page.getByRole('button', { name: /cadastrar|criar/i }).click();

    // Apos cadastro, app deve redirecionar para login
    await expect(page).toHaveURL(/\/login$/, { timeout: 10_000 });

    // 4. Login com a senha inicial
    await page.getByLabel(/e-?mail/i).fill(email);
    await page.getByLabel(/^senha/i).fill(defaultPassword);
    await page.getByRole('button', { name: /entrar|login/i }).click();

    // 5. Chegar em /app/inicio com casca tomador
    await expect(page).toHaveURL(/\/app\/inicio$/, { timeout: 10_000 });
    await expect(page.getByTestId('sep-tomador-email')).toContainText(email);

    // 6. Ir para perfil via tab inferior
    await page.getByTestId('sep-tab-perfil').click();
    await expect(page).toHaveURL(/\/app\/perfil$/);
    await expect(page.getByTestId('sep-profile-email')).toContainText(email);
    await expect(page.getByTestId('sep-profile-role')).toContainText('CLIENTE');

    // 7. Abrir alterar senha
    await page.getByTestId('sep-profile-change-password').click();
    await expect(page).toHaveURL(/\/app\/perfil\/alterar-senha$/);

    // 8. Alterar senha
    await page.getByTestId('sep-change-password-atual').fill(defaultPassword);
    await page.getByTestId('sep-change-password-nova').fill(changedPassword);
    await page.getByTestId('sep-change-password-confirmacao').fill(changedPassword);
    await page.getByTestId('sep-change-password-submit').click();
    await expect(page.getByTestId('sep-change-password-success')).toBeVisible({ timeout: 10_000 });

    // 9. Voltar para perfil
    await page.getByTestId('sep-change-password-cancel').click();
    await expect(page).toHaveURL(/\/app\/perfil$/);

    // 10. Logout
    await page.getByTestId('sep-profile-logout').click();
    await expect(page).toHaveURL(/\/welcome$/, { timeout: 10_000 });

    // 11. Relogin com a nova senha
    await page
      .getByRole('link', { name: /entrar|login/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/login$/);
    await page.getByLabel(/e-?mail/i).fill(email);
    await page.getByLabel(/^senha/i).fill(changedPassword);
    await page.getByRole('button', { name: /entrar|login/i }).click();
    await expect(page).toHaveURL(/\/app\/inicio$/, { timeout: 10_000 });
    await expect(page.getByTestId('sep-tomador-email')).toContainText(email);
  });
});
