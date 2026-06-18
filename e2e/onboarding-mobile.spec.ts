import { expect, test, type Page } from '@playwright/test';

// Jornada de onboarding do tomador servida por MSW (NG_APP_USE_MSW), sem backend real.
// Cobre: login -> home -> onboarding -> dados PF -> envio de documento -> status.
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

test.describe('M-Sprint 6 - onboarding do tomador (MSW)', () => {
  test.beforeEach(async ({ page }) => {
    await enableMsw(page);
  });

  test('tomador inicia onboarding PF, envia documento e ve o status', async ({ page }) => {
    await loginCliente(page);

    // Entrada pela home do tomador.
    await page.getByTestId('sep-tomador-shortcut-onboarding').click();
    await expect(page).toHaveURL(/\/app\/onboarding$/);

    // Selecao do tipo e formulario de dados PF.
    await page.getByTestId('sep-onboarding-choice-pf').click();
    await page.locator('[data-testid="sep-onboarding-pf-cpf"] input').fill('12345678909');
    await page.locator('[data-testid="sep-onboarding-pf-nome"] input').fill('Maria Teste');
    await page.locator('[data-testid="sep-onboarding-pf-nascimento"] input').fill('1990-05-12');
    await page.getByTestId('sep-onboarding-pf-submit').click();

    // Etapa de documentos.
    await expect(page.getByTestId('sep-doc-file')).toBeVisible({ timeout: 10_000 });
    await page.getByTestId('sep-doc-file').setInputFiles({
      name: 'rg.png',
      mimeType: 'image/png',
      buffer: Buffer.from('conteudo-de-teste'),
    });
    await page.getByTestId('sep-doc-tipo').click();
    await page.locator('ion-action-sheet').getByText('RG', { exact: true }).click();
    await page.getByTestId('sep-doc-submit').click();

    // Lista de documentos enviados reflete o envio.
    await expect(page.getByTestId('sep-onboarding-docs-lista')).toContainText('RG', {
      timeout: 10_000,
    });

    // Avanca para o status e ve o badge do backend (mock).
    await page.getByTestId('sep-onboarding-ir-status').click();
    await expect(page.getByTestId('sep-onboarding-status-badge')).toBeVisible();
  });
});
