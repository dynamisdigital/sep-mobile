import { expect, test, type Page } from '@playwright/test';

// Landmark `main` unico por pagina (M-Sprint 17). O `ion-content` do Ionic ja aplica role="main"
// sozinho quando nao esta dentro de ion-menu/ion-popover/ion-modal — que e sempre o caso aqui —,
// e quatro telas publicas envolviam o conteudo num <main> DENTRO desse ion-content, produzindo dois
// landmarks aninhados sem aria-label. O problema era o inverso do web: la faltava landmark, aqui
// sobrava.
//
// Este teste vive no Playwright, e nao no Vitest, porque no happy-dom o web component do Ionic nao
// hidrata: `ion-content` sai com `role` nulo e a contagem daria zero, provando o contrario do que
// se quer. So em browser real o landmark existe para ser contado.
const TELAS_PUBLICAS = [
  { rota: '/welcome', nome: 'welcome' },
  { rota: '/login', nome: 'login' },
  { rota: '/register', nome: 'register' },
  { rota: '/login/verify-totp', nome: 'verify-totp' },
];

async function enableMsw(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem('NG_APP_USE_MSW', 'true');
  });
}

test.describe('M-Sprint 17 - landmarks', () => {
  test.beforeEach(async ({ page }) => {
    await enableMsw(page);
  });

  for (const { rota, nome } of TELAS_PUBLICAS) {
    test(`${nome} tem exatamente um landmark main`, async ({ page }) => {
      await page.goto(rota);
      // A pagina ativa do ion-router-outlet e a unica que conta: o outlet mantem as anteriores no
      // DOM como .ion-page-hidden, e elas trazem os proprios landmarks.
      const paginaAtiva = page.locator('.ion-page:not(.ion-page-hidden)').last();
      await expect(paginaAtiva).toBeVisible();

      // Controle positivo junto com a contagem: exigir >= 1 impede que "zero landmark" — regressao
      // pior que o aninhamento — passe como se estivesse corrigido.
      await expect(paginaAtiva.locator('[role="main"], main')).toHaveCount(1);
    });
  }
});
