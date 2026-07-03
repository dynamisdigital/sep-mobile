import { expect, test, type Locator, type Page } from '@playwright/test';

// Jornada da empresa credora servida por MSW (sem backend real). Cobre: tab Credora condicional
// -> dashboard -> perfil -> oportunidades -> detalhe -> manifestar/cancelar interesse (leitura
// autoritativa) -> carteira -> detalhe; e os recortes de guard (sem credora), inelegibilidade,
// carteira vazia, 320px e tema escuro. O estado da credora e semeado apenas neste contexto
// (localStorage `mock.credora`), entao os outros smokes (default `presente: false`) nao mudam.

interface CredoraSeed {
  presente: boolean;
  elegibilidade?: 'ELEGIVEL' | 'PENDENTE' | 'INELEGIVEL';
  interesse?: 'ATIVO' | 'AUSENTE';
  carteiraVazia?: boolean;
}

function paginaAtiva(page: Page): Locator {
  return page.locator('.ion-page:not(.ion-page-hidden)').last();
}

async function prepararSessao(page: Page, seed: CredoraSeed): Promise<void> {
  await page.addInitScript(
    (estado) => {
      window.localStorage.setItem('NG_APP_USE_MSW', 'true');
      window.localStorage.setItem(
        'mock.credora',
        JSON.stringify({
          presente: estado.presente,
          elegibilidade: estado.elegibilidade ?? 'ELEGIVEL',
          interesse: estado.interesse ?? 'AUSENTE',
          carteiraVazia: estado.carteiraVazia ?? false,
        }),
      );
    },
    seed as Record<string, unknown>,
  );
}

async function loginCliente(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel(/e-?mail/i).fill('cliente@empresa.com');
  await page.getByLabel(/^senha/i).fill('senha-passphrase-segura');
  await page.getByRole('button', { name: /entrar|login/i }).click();
  await expect(page).toHaveURL(/\/app\/inicio$/, { timeout: 10_000 });
}

async function abrirDashboardCredora(page: Page): Promise<void> {
  await expect(page.getByTestId('sep-tab-credora')).toBeVisible({ timeout: 10_000 });
  await page.getByTestId('sep-tab-credora').click();
  await expect(page).toHaveURL(/\/app\/credora\/inicio$/);
  await expect(paginaAtiva(page).getByTestId('sep-credora-razao')).toContainText('Credora Mock', {
    timeout: 10_000,
  });
}

test.describe('M-Sprint 10 - jornada da empresa credora (MSW)', () => {
  test('credora navega dashboard -> perfil -> oportunidades -> interesse -> carteira', async ({
    page,
  }) => {
    await prepararSessao(page, { presente: true });
    await loginCliente(page);
    await abrirDashboardCredora(page);

    // Perfil
    await paginaAtiva(page).getByTestId('sep-credora-atalho-perfil').click();
    await expect(page).toHaveURL(/\/app\/credora\/perfil$/);
    await expect(paginaAtiva(page).getByTestId('sep-credora-perfil-cnpj')).toContainText(
      '11.222.333/0001-81',
      { timeout: 10_000 },
    );
    await page.goBack();

    // Oportunidades: 2 itens (disponivel + encerrada)
    await paginaAtiva(page).getByTestId('sep-credora-atalho-oportunidades').click();
    await expect(page).toHaveURL(/\/app\/credora\/oportunidades$/);
    await expect(
      paginaAtiva(page).getByTestId('sep-oportunidade-item-op-disponivel-1'),
    ).toBeVisible({ timeout: 10_000 });
    await paginaAtiva(page).getByTestId('sep-oportunidade-item-op-disponivel-1').click();
    await expect(page).toHaveURL(/\/oportunidades\/op-disponivel-1$/);

    // Manifestar interesse -> estado autoritativo ATIVO
    const detalhe = paginaAtiva(page);
    await detalhe.getByTestId('sep-interesse-manifestar').click();
    await paginaAtiva(page).getByTestId('sep-interesse-confirm-manifestar-ok').click();
    await expect(paginaAtiva(page).getByTestId('sep-interesse-ativo')).toBeVisible({
      timeout: 10_000,
    });

    // Cancelar interesse -> volta a Manifestar
    await paginaAtiva(page).getByTestId('sep-interesse-cancelar').click();
    await paginaAtiva(page).getByTestId('sep-interesse-confirm-cancelar-ok').click();
    await expect(paginaAtiva(page).getByTestId('sep-interesse-manifestar')).toBeVisible({
      timeout: 10_000,
    });

    // Volta ao dashboard e abre a carteira
    await page.goBack();
    await page.goBack();
    await expect(page).toHaveURL(/\/app\/credora\/inicio$/);
    await paginaAtiva(page).getByTestId('sep-credora-atalho-carteira').click();
    await expect(page).toHaveURL(/\/app\/credora\/carteira$/);
    await paginaAtiva(page).getByTestId('sep-operacao-item-oper-carteira-1').click();
    await expect(paginaAtiva(page).getByTestId('sep-operacao-detalhe-cobranca')).toBeVisible({
      timeout: 10_000,
    });
    await expect(paginaAtiva(page).getByTestId('sep-operacao-detalhe-pagas')).toContainText('2');

    // Assercoes negativas: sem dados internos/admin/aporte/tomador
    const corpo = (await page.locator('body').innerText())
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase();
    expect(corpo).not.toContain('justificativa');
    expect(corpo).not.toContain('associacao assistida operacional');
    expect(corpo).not.toContain('escrow');
    expect(corpo).not.toContain('aporte de');
    expect(corpo).not.toContain('sincronizar');
    expect(corpo).not.toContain('contr-cred');

    // App nao persiste credora/interesse em storage (store e efemero; o seed mock nao conta)
    const persistido = await page.evaluate(() => {
      const l: Record<string, string> = { ...window.localStorage };
      delete l['mock.credora'];
      delete l['NG_APP_USE_MSW'];
      return JSON.stringify(l) + JSON.stringify(window.sessionStorage);
    });
    expect(persistido).not.toContain('Credora Mock');
    expect(persistido).not.toContain('int-mock');
  });

  test('tomador sem credora nao ve tab e nao acessa a rota', async ({ page }) => {
    await prepararSessao(page, { presente: false });
    await loginCliente(page);
    await expect(page.getByTestId('sep-tab-credora')).toHaveCount(0);

    // Acesso direto e barrado pelo guard -> superficie neutra
    await page.goto('/app/credora/inicio');
    await expect(page).toHaveURL(/\/app\/inicio$/, { timeout: 10_000 });
  });

  test('credora inelegivel nao manifesta interesse', async ({ page }) => {
    await prepararSessao(page, { presente: true, elegibilidade: 'INELEGIVEL' });
    await loginCliente(page);
    await abrirDashboardCredora(page);
    await paginaAtiva(page).getByTestId('sep-credora-atalho-oportunidades').click();
    await paginaAtiva(page).getByTestId('sep-oportunidade-item-op-disponivel-1').click();
    await expect(paginaAtiva(page).getByTestId('sep-interesse-indisponivel')).toBeVisible({
      timeout: 10_000,
    });
    await expect(paginaAtiva(page).getByTestId('sep-interesse-ativo')).toHaveCount(0);
  });

  test('carteira vazia explica que interesse nao gera carteira', async ({ page }) => {
    await prepararSessao(page, { presente: true, carteiraVazia: true });
    await loginCliente(page);
    await abrirDashboardCredora(page);
    await paginaAtiva(page).getByTestId('sep-credora-atalho-carteira').click();
    await expect(paginaAtiva(page).getByTestId('sep-carteira-vazia')).toContainText(
      'nao gera carteira',
      { timeout: 10_000 },
    );
  });

  test('dashboard e detalhe nao estouram overflow em 320px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await prepararSessao(page, { presente: true });
    await loginCliente(page);
    await abrirDashboardCredora(page);
    await paginaAtiva(page).getByTestId('sep-credora-atalho-oportunidades').click();
    await paginaAtiva(page).getByTestId('sep-oportunidade-item-op-disponivel-1').click();
    await expect(paginaAtiva(page).getByTestId('sep-oportunidade-detalhe-valor')).toBeVisible({
      timeout: 10_000,
    });
    const semOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    );
    expect(semOverflow).toBe(true);
  });

  test('tema escuro renderiza as superficies da credora', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await prepararSessao(page, { presente: true });
    await loginCliente(page);
    await abrirDashboardCredora(page);
    await expect(paginaAtiva(page).getByTestId('sep-credora-status-elegibilidade')).toBeVisible();
  });
});
