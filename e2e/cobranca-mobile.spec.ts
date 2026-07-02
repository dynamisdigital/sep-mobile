import { expect, test, type Locator, type Page } from '@playwright/test';

// Jornada de cobranca do tomador servida por MSW (sem backend real). Cobre: tab Parcelas ->
// proposta aprovada -> agenda (7 status) -> parcela atrasada com detalhe atualizado ->
// historico de recebimentos (B1) -> termos da renegociacao (B2) -> step-up -> retorno sem
// aceite automatico -> aceite explicito -> agenda substituta ativa; e a recusa sem step-up.
// A proposta APROVADA e o contrato ASSINADO sao semeados apenas neste contexto (localStorage
// por teste), entao os outros smokes nao sao afetados.
const PROPOSTA_ID = 'prop-formalizacao-1';

// O ion-router-outlet mantem paginas anteriores no DOM (com .ion-page-hidden). Testids que se
// repetem entre telas (status de parcela, itens de agenda) precisam ser buscados apenas na
// pagina ativa para nao violar o strict mode do Playwright.
function paginaAtiva(page: Page): Locator {
  return page.locator('.ion-page:not(.ion-page-hidden)').last();
}

async function prepararSessao(page: Page): Promise<void> {
  await page.addInitScript(
    ({ propostaId }) => {
      window.localStorage.setItem('NG_APP_USE_MSW', 'true');
      // Contrato ja ASSINADO: a jornada de parcelas exige agenda pos-assinatura.
      window.localStorage.setItem('mock.formalizacao', JSON.stringify({ status: 'ASSINADO' }));
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
    { propostaId: PROPOSTA_ID },
  );
}

async function loginCliente(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel(/e-?mail/i).fill('cliente@empresa.com');
  await page.getByLabel(/^senha/i).fill('senha-passphrase-segura');
  await page.getByRole('button', { name: /entrar|login/i }).click();
  await expect(page).toHaveURL(/\/app\/inicio$/, { timeout: 10_000 });
}

async function abrirAgenda(page: Page): Promise<void> {
  await page.getByTestId('sep-tab-parcelas').click();
  await expect(page).toHaveURL(/\/app\/parcelas$/);
  await paginaAtiva(page).getByTestId('sep-parcelas-entry-item').first().click();
  await expect(page).toHaveURL(new RegExp(`/app/parcelas/proposta/${PROPOSTA_ID}$`));
  // Agenda original com os 7 status visiveis.
  await expect(paginaAtiva(page).getByTestId('sep-agenda-item')).toHaveCount(7, {
    timeout: 10_000,
  });
}

async function verDetalheEHistoricoDaParcelaAtrasada(page: Page): Promise<void> {
  await paginaAtiva(page).getByTestId('sep-agenda-item').filter({ hasText: 'Parcela 4' }).click();
  const detalhe = paginaAtiva(page);
  await expect(detalhe.getByTestId('sep-parcela-atualizar')).toBeVisible({ timeout: 10_000 });
  // Detalhe atualizado vem pronto do backend (mora/multa ficticias do mock).
  await expect(detalhe.getByTestId('sep-parcela-status')).toContainText('Atrasada');

  // Historico da parcela atrasada: carregado sob demanda e vazio (estado proprio).
  await detalhe.getByTestId('sep-parcela-historico-toggle').click();
  await expect(detalhe.getByTestId('sep-parcela-historico-vazio')).toBeVisible();
  await page.goBack();
  await expect(paginaAtiva(page).getByTestId('sep-agenda-item')).toHaveCount(7);
}

async function abrirTermosDaRenegociacao(page: Page): Promise<void> {
  await paginaAtiva(page).getByTestId('sep-agenda-item').filter({ hasText: 'Parcela 5' }).click();
  const detalhe = paginaAtiva(page);
  await expect(detalhe.getByTestId('sep-parcela-status')).toContainText('Em negociacao', {
    timeout: 10_000,
  });

  // Historico com recebimento parcial (B1): data, valor e meio de pagamento.
  await detalhe.getByTestId('sep-parcela-historico-toggle').click();
  await expect(detalhe.getByTestId('sep-parcela-historico-lista')).toContainText('PIX');
  await expect(detalhe.getByTestId('sep-parcela-historico-lista')).toContainText('300');

  await detalhe.getByTestId('sep-parcela-ver-renegociacao').click();
  const reneg = paginaAtiva(page);
  await expect(reneg.getByTestId('sep-reneg-termos')).toBeVisible({ timeout: 10_000 });
  // Termos completos antes da decisao; total calculado no backend (330 = mock, nunca local).
  const termos = reneg.getByTestId('sep-reneg-termos');
  await expect(termos).toContainText('330');
  await expect(termos).toContainText('110');
  await expect(termos).toContainText('3');
}

async function aceitarComStepUp(page: Page): Promise<void> {
  // 1a tentativa: sem token -> vai ao step-up (nenhum PATCH disparado).
  await paginaAtiva(page).getByTestId('sep-reneg-aceitar').click();
  await paginaAtiva(page).getByTestId('sep-reneg-aceitar-confirmar').click();
  await expect(page).toHaveURL(/\/app\/step-up\?next=/);

  await paginaAtiva(page).getByTestId('sep-step-up-codigo').fill('123456');
  await paginaAtiva(page).getByTestId('sep-step-up-submit').click();

  // Retorno a renegociacao: termos recarregados, nenhum aceite automatico.
  await expect(page).toHaveURL(/\/renegociacao$/);
  const reneg = paginaAtiva(page);
  await expect(reneg.getByTestId('sep-reneg-aceitar')).toBeVisible({ timeout: 10_000 });

  // 2a tentativa: token presente -> aceite efetivo -> agenda substituta ativa (3 parcelas).
  await reneg.getByTestId('sep-reneg-aceitar').click();
  await reneg.getByTestId('sep-reneg-aceitar-confirmar').click();
  await expect(page).toHaveURL(/\/app\/parcelas\/contratos\/contrato-mock-1$/, {
    timeout: 10_000,
  });
  await expect(paginaAtiva(page).getByTestId('sep-agenda-item')).toHaveCount(3, {
    timeout: 10_000,
  });
}

async function jornadaAceite(page: Page): Promise<void> {
  await loginCliente(page);
  await abrirAgenda(page);
  await verDetalheEHistoricoDaParcelaAtrasada(page);
  await abrirTermosDaRenegociacao(page);
  await aceitarComStepUp(page);
}

test.describe('M-Sprint 9 - cobranca do tomador (MSW)', () => {
  test.beforeEach(async ({ page }) => {
    await prepararSessao(page);
  });

  test('tomador ve agenda, historico e aceita renegociacao com step-up', async ({ page }) => {
    await jornadaAceite(page);

    // Assercoes negativas: nenhuma operacao interna, ID de operador/escrow ou justificativa.
    const corpo = await page.locator('body').innerText();
    const normalizado = corpo.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    expect(normalizado).not.toContain('tomadorid');
    expect(normalizado).not.toContain('propostapor');
    expect(normalizado).not.toContain('escrow');
    expect(normalizado).not.toContain('justificativa');
    expect(normalizado).not.toContain('registrar recebimento');
    expect(normalizado).not.toContain('propor renegociacao');

    // Step-up token nunca persistido em storage (memoria, uso unico).
    const storage = await page.evaluate(() => ({
      local: JSON.stringify(window.localStorage),
      session: JSON.stringify(window.sessionStorage),
    }));
    expect(storage.local).not.toContain('mock-step-up-token');
    expect(storage.session).not.toContain('mock-step-up-token');
  });

  test('tomador recusa renegociacao sem step-up e parcela volta ao status anterior', async ({
    page,
  }) => {
    await loginCliente(page);
    await abrirAgenda(page);
    await abrirTermosDaRenegociacao(page);

    await paginaAtiva(page).getByTestId('sep-reneg-recusar').click();
    await paginaAtiva(page).getByTestId('sep-reneg-recusar-confirmar').click();

    // Recusa nao passa pelo step-up: volta direto ao detalhe da parcela, agora ATRASADA.
    await expect(page).toHaveURL(/\/parcelas\/parcela-cobranca-5$/, { timeout: 10_000 });
    const detalhe = paginaAtiva(page);
    await expect(detalhe.getByTestId('sep-parcela-status')).toContainText('Atrasada', {
      timeout: 10_000,
    });
    // CTA de termos some: nao ha mais renegociacao ativa.
    await expect(detalhe.getByTestId('sep-parcela-ver-renegociacao')).toHaveCount(0);
  });

  test('jornada critica nao estoura overflow em 320px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await jornadaAceite(page);
    const semOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    );
    expect(semOverflow).toBe(true);
  });
});
