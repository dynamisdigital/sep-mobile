import { expect, test, type Page } from '@playwright/test';

// Landmark `main` unico por pagina (M-Sprint 17). O `ion-content` do Ionic ja aplica role="main"
// sozinho quando nao esta dentro de ion-menu/ion-popover/ion-modal — e o app nao usa nenhum dos
// tres —, e quatro telas publicas envolviam o conteudo num <main> DENTRO desse ion-content,
// produzindo dois landmarks aninhados sem aria-label. O problema era o inverso do web: la faltava
// landmark, aqui sobrava.
//
// Este teste vive no Playwright, e nao no Vitest, porque no happy-dom o web component do Ionic nao
// hidrata: `ion-content` sai com `role` nulo e a contagem daria zero, provando o contrario do que
// se quer. So em browser real o landmark existe para ser contado.
//
// A contagem e do DOCUMENTO inteiro, nao da pagina ativa. Filtrar por
// `.ion-page:not(.ion-page-hidden)` seria pior do que parece: `ion-app` tambem carrega a classe
// `ion-page`, entao quem isolaria a pagina seria o `.last()`, e nao o filtro — e um landmark
// injetado no shell (`app.component.html`) ficaria invisivel. Cada teste faz `goto` limpo, entao ha
// exatamente uma pagina montada e o escopo amplo nao gera falso positivo.
const CHALLENGE_KEY = 'CapacitorStorage.sep.auth.pendingMfaChallenge';

async function semearChallengeMfa(page: Page): Promise<void> {
  await page.addInitScript((chave) => {
    window.localStorage.setItem(chave, 'challenge-landmark-e2e');
  }, CHALLENGE_KEY);
}

async function esperarLandmarkUnico(page: Page, rota: string): Promise<void> {
  await page.goto(rota);
  await expect(page.locator('ion-content')).toBeVisible();
  // toHaveCount(1) e controle positivo e negativo ao mesmo tempo: pega o aninhamento antigo (2) e
  // tambem a tela ficar sem landmark nenhum (0), que seria regressao pior.
  await expect(page.locator('[role="main"], main')).toHaveCount(1);
}

test.describe('M-Sprint 17 - landmarks', () => {
  for (const { rota, nome } of [
    { rota: '/welcome', nome: 'welcome' },
    { rota: '/login', nome: 'login' },
    { rota: '/register', nome: 'register' },
  ]) {
    test(`${nome} tem exatamente um landmark main`, async ({ page }) => {
      await esperarLandmarkUnico(page, rota);
    });
  }

  // O verify-totp tem dois ramos e o formulario so renderiza com challenge pendente. Sem semear,
  // o teste exercitaria apenas o estado degradado ("Sessao expirada") e um <main> introduzido no
  // ramo do formulario passaria despercebido.
  test('verify-totp com challenge pendente tem exatamente um landmark main', async ({ page }) => {
    await semearChallengeMfa(page);
    await esperarLandmarkUnico(page, '/login/verify-totp');
    await expect(page.getByRole('heading', { name: /Verificacao em duas etapas/i })).toBeVisible();
    // Prova que o ramo do formulario foi o renderizado, e nao o de sessao expirada.
    await expect(
      page.getByRole('button', { name: /confirmar|verificar|entrar/i }).first(),
    ).toBeVisible();
  });

  test('verify-totp sem challenge tem exatamente um landmark main', async ({ page }) => {
    await esperarLandmarkUnico(page, '/login/verify-totp');
    await expect(page.getByRole('heading', { name: /Sessao expirada/i })).toBeVisible();
  });
});
