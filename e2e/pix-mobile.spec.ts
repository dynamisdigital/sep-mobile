import { expect, test, type Locator, type Page } from '@playwright/test';

// Jornada Pix visivel ao usuario (M-Sprint 11 / backend Sprint 26 Gates P1-P3), servida por MSW.
// Cobre: desembolso Pix no contrato assinado (P1), status Pix da parcela + destaque no historico
// (P2) e status Pix da operacao da carteira da credora (P3). Estado semeado por teste
// (localStorage), sem afetar os outros smokes. Leituras read-only, sem step-up, sem endpoint
// operacional, sem dado tecnico (txid/copia-cola/endToEndId/chave/escrow) no DOM nem em storage.
const PROPOSTA_ID = 'prop-formalizacao-1';

// O ion-router-outlet mantem paginas anteriores no DOM (.ion-page-hidden). Testids repetidos entre
// telas devem ser buscados so na pagina ativa (strict mode do Playwright).
function paginaAtiva(page: Page): Locator {
  return page.locator('.ion-page:not(.ion-page-hidden)').last();
}

// `pix` semeia `mock.pix` (estado reseedavel): `desembolso` (status P1 ou 'AUSENTE') e `falhar`
// (proxima leitura Pix retorna 5xx uma vez). Omitido = happy path do handler.
async function prepararTomador(
  page: Page,
  pix?: { desembolso?: string; falhar?: boolean },
): Promise<void> {
  await page.addInitScript(
    ({ propostaId, pix }) => {
      window.localStorage.setItem('NG_APP_USE_MSW', 'true');
      // Contrato ASSINADO: habilita o card de desembolso Pix.
      window.localStorage.setItem('mock.formalizacao', JSON.stringify({ status: 'ASSINADO' }));
      if (pix) {
        window.localStorage.setItem('mock.pix', JSON.stringify(pix));
      }
      window.localStorage.setItem(
        'mock.credito.propostas',
        JSON.stringify([
          {
            id: propostaId,
            tomadorId: '1f0799c0-98b9-6d9d-bc4a-7d6f5b771001',
            solicitacaoOnboardingId: 'onb-smoke-1',
            tipoOperacao: 'CAPITAL_GIRO',
            valorSolicitado: 10000,
            moeda: 'BRL',
            prazoMeses: 12,
            status: 'APROVADA',
            dataCriacao: '2026-06-20T09:00:00-03:00',
            dataModificacao: '2026-06-20T09:00:00-03:00',
            score: null,
            parecer: null,
          },
        ]),
      );
    },
    { propostaId: PROPOSTA_ID, pix: pix ?? null },
  );
}

async function prepararCredora(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem('NG_APP_USE_MSW', 'true');
    window.localStorage.setItem(
      'mock.credora',
      JSON.stringify({
        presente: true,
        elegibilidade: 'ELEGIVEL',
        interesse: 'AUSENTE',
        carteiraVazia: false,
      }),
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

async function abrirContratoAssinado(page: Page): Promise<Locator> {
  await page.getByTestId('sep-tomador-shortcut-formalizacao').click();
  await expect(page).toHaveURL(/\/app\/formalizacao$/);
  await paginaAtiva(page).getByTestId('sep-formalizacao-item').first().click();
  await expect(page).toHaveURL(new RegExp(`/app/formalizacao/proposta/${PROPOSTA_ID}$`));
  return paginaAtiva(page);
}

async function abrirAgenda(page: Page): Promise<void> {
  await page.getByTestId('sep-tab-parcelas').click();
  await expect(page).toHaveURL(/\/app\/parcelas$/);
  await paginaAtiva(page).getByTestId('sep-parcelas-entry-item').first().click();
  await expect(paginaAtiva(page).getByTestId('sep-agenda-item')).toHaveCount(7, {
    timeout: 10_000,
  });
}

test.describe('M-Sprint 11 - Pix visivel ao usuario (MSW)', () => {
  test('tomador ve o desembolso Pix do contrato e o status Pix da parcela', async ({ page }) => {
    // Coleta as URLs Pix/carteira tocadas para provar que nenhuma rota operacional foi chamada.
    const urlsPix: string[] = [];
    page.on('request', (req) => {
      const url = req.url();
      if (url.includes('/pix/') || url.includes('/carteira/')) {
        urlsPix.push(url);
      }
    });

    await prepararTomador(page);
    await loginCliente(page);

    // P1 — desembolso Pix no contrato ASSINADO.
    const contrato = await abrirContratoAssinado(page);
    await expect(contrato.getByTestId('sep-contrato-detail-desembolso')).toBeVisible({
      timeout: 10_000,
    });
    await expect(contrato.getByTestId('sep-pix-status-publico')).toContainText('Em processamento');
    await expect(contrato.getByTestId('sep-contrato-detail-desembolso-valor')).toContainText('R$');

    // P2 — status Pix da parcela 4 (AGUARDANDO).
    await abrirAgenda(page);
    await paginaAtiva(page).getByTestId('sep-agenda-item').filter({ hasText: 'Parcela 4' }).click();
    const parcela4 = paginaAtiva(page);
    await expect(parcela4.getByTestId('sep-parcela-pix')).toBeVisible({ timeout: 10_000 });
    await expect(parcela4.getByTestId('sep-pix-status-parcela')).toContainText('Aguardando');
    await page.goBack();
    await expect(paginaAtiva(page).getByTestId('sep-agenda-item')).toHaveCount(7);

    // P2 — historico da parcela 5 com o meio PIX destacado (reuso do contrato B1 da M-9).
    await paginaAtiva(page).getByTestId('sep-agenda-item').filter({ hasText: 'Parcela 5' }).click();
    const parcela5 = paginaAtiva(page);
    await parcela5.getByTestId('sep-parcela-historico-toggle').click();
    await expect(parcela5.getByTestId('sep-parcela-historico-lista')).toContainText('PIX');
    await expect(
      parcela5.getByTestId('sep-parcela-historico-meio').filter({ hasText: 'PIX' }),
    ).toHaveClass(/sep-parcela-historico-meio--pix/);

    // Parcela 5 nao tem estado Pix proprio (P2 404): ausencia neutra, distinta de erro tecnico.
    await expect(parcela5.getByTestId('sep-parcela-pix-indisponivel')).toBeVisible();

    // Assercoes negativas: nada de dado tecnico Pix no DOM nem em storage.
    const corpo = (await page.locator('body').innerText()).toLowerCase();
    expect(corpo).not.toContain('txid');
    expect(corpo).not.toContain('copia-cola');
    expect(corpo).not.toContain('endtoend');
    expect(corpo).not.toContain('escrow');
    const storage = await page.evaluate(
      () => JSON.stringify(window.localStorage) + JSON.stringify(window.sessionStorage),
    );
    expect(storage.toLowerCase()).not.toContain('desembolso');
    expect(storage.toLowerCase()).not.toContain('txid');

    // Apenas as tres leituras owner-scoped: nenhuma rota operacional Pix (desembolsos/recebimentos/
    // referencias/webhooks) foi tocada.
    expect(urlsPix.some((u) => /\/pix\/contratos\/[^/]+\/desembolso/.test(u))).toBe(true);
    expect(urlsPix.some((u) => /\/pix\/parcelas\/[^/]+\/status/.test(u))).toBe(true);
    expect(
      urlsPix.filter((u) => /\/pix\/(desembolsos|recebimentos|referencias|webhooks)/.test(u)),
    ).toEqual([]);
  });

  test('credora ve o status Pix da operacao da carteira', async ({ page }) => {
    await prepararCredora(page);
    await loginCliente(page);

    await expect(page.getByTestId('sep-tab-credora')).toBeVisible({ timeout: 10_000 });
    await page.getByTestId('sep-tab-credora').click();
    await expect(page).toHaveURL(/\/app\/credora\/inicio$/);
    await paginaAtiva(page).getByTestId('sep-credora-atalho-carteira').click();
    await expect(page).toHaveURL(/\/app\/credora\/carteira$/);
    await paginaAtiva(page).getByTestId('sep-operacao-item-oper-carteira-1').click();

    const detalhe = paginaAtiva(page);
    await expect(detalhe.getByTestId('sep-operacao-detalhe-pix')).toBeVisible({ timeout: 10_000 });
    await expect(detalhe.getByTestId('sep-pix-status-publico')).toContainText('Liquidado');
    await expect(detalhe.getByTestId('sep-operacao-detalhe-pix-valor')).toContainText('R$');

    // O card nao expoe tomador, contrato, txid nem escrow.
    const card = (await detalhe.getByTestId('sep-operacao-detalhe-pix').innerText()).toLowerCase();
    expect(card).not.toContain('contrato');
    expect(card).not.toContain('tomador');
    expect(card).not.toContain('txid');
    expect(card).not.toContain('escrow');
  });

  test('desembolso Pix com 5xx exibe erro isolado, e o retry recarrega', async ({ page }) => {
    // Primeira leitura Pix falha (5xx); o retry seguinte sucede com o status semeado.
    await prepararTomador(page, { desembolso: 'LIQUIDADO', falhar: true });
    await loginCliente(page);

    const contrato = await abrirContratoAssinado(page);
    await expect(contrato.getByTestId('sep-contrato-detail-desembolso-erro')).toBeVisible({
      timeout: 10_000,
    });
    // O contrato continua utilizavel apesar da falha do card Pix (leitura isolada).
    await expect(contrato.getByTestId('sep-contrato-detail-versao')).toBeVisible();

    await contrato.getByTestId('sep-contrato-detail-desembolso-atualizar').click();
    await expect(contrato.getByTestId('sep-pix-status-publico')).toContainText('Liquidado', {
      timeout: 10_000,
    });
    await expect(contrato.getByTestId('sep-contrato-detail-desembolso-erro')).toHaveCount(0);
  });

  test('desembolso Pix ausente (404) mostra indisponivel, nao erro', async ({ page }) => {
    await prepararTomador(page, { desembolso: 'AUSENTE', falhar: false });
    await loginCliente(page);

    const contrato = await abrirContratoAssinado(page);
    await expect(contrato.getByTestId('sep-contrato-detail-desembolso-indisponivel')).toBeVisible({
      timeout: 10_000,
    });
    await expect(contrato.getByTestId('sep-contrato-detail-desembolso-erro')).toHaveCount(0);
  });

  test('tema escuro renderiza o card de desembolso Pix', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await prepararTomador(page);
    await loginCliente(page);
    const contrato = await abrirContratoAssinado(page);
    await expect(contrato.getByTestId('sep-contrato-detail-desembolso')).toBeVisible({
      timeout: 10_000,
    });
    await expect(contrato.getByTestId('sep-pix-status-publico')).toBeVisible();
  });

  test('jornada Pix do tomador nao estoura overflow em 320px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await prepararTomador(page);
    await loginCliente(page);
    const contrato = await abrirContratoAssinado(page);
    await expect(contrato.getByTestId('sep-contrato-detail-desembolso')).toBeVisible({
      timeout: 10_000,
    });
    const semOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    );
    expect(semOverflow).toBe(true);
  });
});
