import { expect, test, type Page } from '@playwright/test';

// Jornada de formalizacao do tomador servida por MSW (sem backend real). Cobre: entrada por
// proposta aprovada -> leitura da versao vigente (numero/hash/conteudo) -> historico -> aceite com
// step-up -> retorno sem aceite automatico -> aceite efetivo -> status ate ASSINADO -> download do
// PDF ficticio. A proposta APROVADA e semeada apenas neste contexto (localStorage por teste), entao
// os outros smokes nao sao afetados.
const PROPOSTA_ID = 'prop-formalizacao-1';
const CONTRATO_ID = 'contrato-mock-1';

async function prepararSessao(page: Page): Promise<void> {
  await page.addInitScript(
    ({ propostaId }) => {
      window.localStorage.setItem('NG_APP_USE_MSW', 'true');
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

async function abrirContrato(page: Page): Promise<void> {
  await page.getByTestId('sep-tomador-shortcut-formalizacao').click();
  await expect(page).toHaveURL(/\/app\/formalizacao$/);
  await page.getByTestId('sep-formalizacao-item').first().click();
  await expect(page).toHaveURL(new RegExp(`/app/formalizacao/proposta/${PROPOSTA_ID}$`));
  await expect(page.getByTestId('sep-contrato-detail-versao')).toBeVisible({ timeout: 10_000 });
}

async function lerVersaoEHistorico(page: Page): Promise<void> {
  await expect(page.getByTestId('sep-contrato-detail-hash')).toBeVisible();
  await expect(page.getByTestId('sep-contrato-detail-conteudo')).toContainText('condicoes gerais');

  await page.getByTestId('sep-contrato-detail-historico-abrir').click();
  await page.getByTestId('sep-contrato-detail-historico-item').first().click();
  await expect(page.getByTestId('sep-contrato-detail-voltar-vigente')).toBeVisible();
  await page.getByTestId('sep-contrato-detail-voltar-vigente').click();
}

async function aceitarComStepUp(page: Page): Promise<void> {
  // 1a tentativa: sem token -> vai ao step-up.
  await page.getByTestId('sep-contrato-detail-aceitar').click();
  await page.getByTestId('sep-contrato-detail-confirmar').click();
  await expect(page).toHaveURL(/\/app\/step-up\?next=/);

  await page.getByTestId('sep-step-up-codigo').fill('123456');
  await page.getByTestId('sep-step-up-submit').click();

  // Retorno ao contrato: nenhum aceite automatico; o CTA de aceitar continua disponivel.
  await expect(page).toHaveURL(new RegExp(`/app/formalizacao/contratos/${CONTRATO_ID}$`));
  await expect(page.getByTestId('sep-contrato-detail-aceitar')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('sep-contrato-detail-assinatura')).toHaveCount(0);

  // 2a tentativa: token presente -> aceite efetivo.
  await page.getByTestId('sep-contrato-detail-aceitar').click();
  await page.getByTestId('sep-contrato-detail-confirmar').click();
  await expect(page.getByTestId('sep-contrato-detail-assinatura')).toBeVisible({ timeout: 10_000 });
}

async function avancarAteAssinado(page: Page): Promise<void> {
  for (let tentativa = 0; tentativa < 4; tentativa += 1) {
    if (
      await page
        .getByTestId('sep-contrato-detail-documento')
        .isVisible()
        .catch(() => false)
    ) {
      return;
    }
    await page.getByTestId('sep-contrato-detail-status-atualizar').click();
    await expect(page.getByTestId('sep-contrato-detail-assinatura-status')).toBeVisible();
  }
  await expect(page.getByTestId('sep-contrato-detail-documento')).toBeVisible({ timeout: 5_000 });
}

async function jornadaFormalizacao(page: Page): Promise<void> {
  await loginCliente(page);
  await abrirContrato(page);
  await lerVersaoEHistorico(page);
  await aceitarComStepUp(page);
  await avancarAteAssinado(page);

  const download = page.waitForEvent('download');
  await page.getByTestId('sep-contrato-detail-documento').click();
  expect((await download).suggestedFilename()).toContain('assinado.pdf');
  await expect(page.getByTestId('sep-contrato-detail-documento-erro')).toHaveCount(0);
}

test.describe('M-Sprint 8 - formalizacao e contrato (MSW)', () => {
  test.beforeEach(async ({ page }) => {
    await prepararSessao(page);
  });

  test('tomador le, aceita com step-up e baixa o contrato assinado', async ({ page }) => {
    await jornadaFormalizacao(page);

    // Assercoes negativas: sem dados tecnicos de aceite/envelope nem operacoes internas no DOM.
    const corpo = await page.locator('body').innerText();
    const normalizado = corpo.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    expect(normalizado).not.toContain('env-ext-mock');
    expect(normalizado).not.toContain('reprocess');
    expect(normalizado).not.toContain('cancelar contrato');
    expect(normalizado).not.toContain('enviar para assinatura');

    // Step-up token nunca persistido em storage (fica em memoria, uso unico).
    const storage = await page.evaluate(() => ({
      local: JSON.stringify(window.localStorage),
      session: JSON.stringify(window.sessionStorage),
    }));
    expect(storage.local).not.toContain('mock-step-up-token');
    expect(storage.session).not.toContain('mock-step-up-token');
  });

  test('jornada critica nao estoura overflow em 320px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await jornadaFormalizacao(page);
    const semOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    );
    expect(semOverflow).toBe(true);
  });
});
