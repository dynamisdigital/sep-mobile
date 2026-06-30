import { expect, test, type Page } from '@playwright/test';

// Jornada de credito + Open Finance do tomador servida por MSW (NG_APP_USE_MSW), sem backend
// real. Cobre: login -> lista vazia -> criar proposta (ponteiro de onboarding semeado) ->
// detalhe/status -> consentimento Open Finance -> handoff -> retorno AUTORIZADO + agregados.
// O ponteiro {tipo,onboardingId} e semeado direto no storage do Capacitor Preferences (web).
async function prepararSessao(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem('NG_APP_USE_MSW', 'true');
    window.localStorage.setItem(
      'CapacitorStorage.sep.onboarding.journey',
      JSON.stringify({ tipo: 'PF', onboardingId: 'pf-smoke-1' }),
    );
  });
}

async function loginCliente(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel(/e-?mail/i).fill('cliente@empresa.com');
  await page.getByLabel(/^senha/i).fill('senha-passphrase-segura');
  await page.getByRole('button', { name: /entrar|login/i }).click();
  await expect(page).toHaveURL(/\/app\/inicio$/, { timeout: 10_000 });
}

// Percorre toda a jornada e devolve o texto final visivel para as assercoes negativas LGPD.
async function jornadaCredito(page: Page): Promise<void> {
  await loginCliente(page);

  // Lista vazia.
  await page.getByTestId('sep-tomador-shortcut-acompanhar').click();
  await expect(page).toHaveURL(/\/app\/propostas$/);
  await expect(page.getByTestId('sep-propostas-vazio')).toBeVisible({ timeout: 10_000 });

  // Criacao da proposta (tipo ja vem CAPITAL_GIRO; ponteiro de onboarding nao aparece no form).
  await page.goBack();
  await page.getByTestId('sep-tomador-shortcut-solicitar').click();
  await expect(page).toHaveURL(/\/app\/propostas\/nova$/);
  await page.locator('[data-testid="sep-proposta-create-valor"] input').fill('10000');
  await page.locator('[data-testid="sep-proposta-create-prazo"] input').fill('12');
  await page.getByTestId('sep-proposta-create-submit').click();

  // Detalhe + status, sem controles internos.
  await expect(page).toHaveURL(/\/app\/propostas\/prop-mock-1$/, { timeout: 10_000 });
  await expect(page.getByTestId('sep-proposta-status')).toContainText('Em analise');
  await expect(page.getByTestId('sep-proposta-detail-parecer')).toHaveCount(0);

  // Consentimento Open Finance.
  await page.getByTestId('sep-proposta-detail-open-finance').click();
  await expect(page).toHaveURL(/\/open-finance$/);
  await page.locator('[data-testid="sep-open-finance-documento"] input').fill('12345678901');
  await page.getByTestId('sep-open-finance-iniciar').click();

  // Retorno (handoff via redirectUri do app) -> AUTORIZADO + agregados.
  await expect(page).toHaveURL(/\/open-finance\/retorno$/, { timeout: 10_000 });
  await expect(page.getByTestId('sep-open-finance-status')).toContainText('Autorizado');
  await expect(page.getByTestId('sep-open-finance-agregados')).toBeVisible();
}

test.describe('M-Sprint 7 - credito e Open Finance (MSW)', () => {
  test.beforeEach(async ({ page }) => {
    await prepararSessao(page);
  });

  test('tomador cria proposta, acompanha status e autoriza Open Finance', async ({ page }) => {
    await jornadaCredito(page);

    // Assercoes negativas (LGPD): nada de trilha de regras, parecerista ou PII bancaria.
    const corpo = await page.locator('body').innerText();
    expect(corpo).not.toContain('parecerista');
    expect(corpo).not.toContain('pareceristaId');
    expect(corpo.toLowerCase()).not.toContain('agencia');
    expect(corpo).not.toContain('12345678901');
  });

  test('jornada critica nao estoura overflow em 320px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await jornadaCredito(page);
    const semOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    );
    expect(semOverflow).toBe(true);
  });
});
