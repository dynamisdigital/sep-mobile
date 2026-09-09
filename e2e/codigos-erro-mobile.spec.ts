import { expect, test, type Page } from '@playwright/test';

// M-Sprint 18 — consumo do `codigo` de erro publicado pela Sprint 36.
//
// Dois blocos, com naturezas DIFERENTES, e a distincao importa para nao se enganar sobre o que cada
// um prova:
//
//  1. `mock MSW` — exercita `src/mocks/handlers.ts` de verdade, pelo service worker. E o unico lugar
//     que prova o handler: o MSW nao esta plugado no Vitest, entao os testes unitarios usam doubles
//     e nao veriam uma regressao no mock.
//  2. `ramo TOTP` — NAO usa MSW. O mock nao expoe `/auth/totp/verify` (ver o comentario em
//     `handlers.ts`), entao aqui a interceptacao e `page.route`, explicita e isolada a estes testes.
//     **Isto e fixture de teste, nao prova de backend**: afirma o comportamento do APP diante de um
//     corpo com `codigo`, e nada afirma sobre o que o `sep-api` devolve. O smoke real contra `:8080`
//     e outro gate, declarado no fechamento da sprint.
const LOGIN_URL = 'http://localhost:8080/api/v1/auth/login';
const USUARIO = 'cliente@empresa.com';
const SENHA_CORRETA = 'senha-passphrase-segura';
const SENHA_ERRADA = 'senha-errada-que-nao-confere';

async function abrirComMsw(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem('NG_APP_USE_MSW', 'true');
  });
  await page.goto('/welcome');
  await page.waitForFunction(() => !!navigator.serviceWorker?.controller, { timeout: 15_000 });
}

async function corpoDoLogin(
  page: Page,
  password: string,
): Promise<{ status: number; corpo: Record<string, unknown> }> {
  return page.evaluate(
    async ([url, u, p]) => {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: u, password: p }),
      });
      return { status: res.status, corpo: (await res.json()) as Record<string, unknown> };
    },
    [LOGIN_URL, USUARIO, password],
  );
}

test.describe('M-Sprint 18 - codigo de erro no mock MSW', () => {
  test.beforeEach(async ({ page }) => {
    await abrirComMsw(page);
  });

  test('o 423 do login publica AUTH-423-001, como o handleLocked do sep-api', async ({ page }) => {
    let resposta = await corpoDoLogin(page, SENHA_ERRADA);
    for (let i = 0; i < 5 && resposta.status !== 423; i++) {
      resposta = await corpoDoLogin(page, SENHA_ERRADA);
    }

    expect(resposta.status).toBe(423);
    expect(resposta.corpo['codigo']).toBe('AUTH-423-001');
  });

  // Controle negativo, e o que impede o mock de virar mais generoso que a producao: no `sep-api` a
  // credencial recusada cai no `handleAuth`, que monta o corpo SEM codigo.
  test('o 401 do login continua sem codigo', async ({ page }) => {
    const resposta = await corpoDoLogin(page, SENHA_ERRADA);

    expect(resposta.status).toBe(401);
    expect(resposta.corpo).not.toHaveProperty('codigo');
    expect(resposta.corpo['message']).toBe('Credenciais invalidas');
  });
});

test.describe('M-Sprint 18 - ramo TOTP por codigo (fixture page.route, sem MSW)', () => {
  // O desafio e persistido pelo MECANISMO REAL do app: o login devolve `mfaRequired: true` e o
  // `AuthService.handleTokenResponse` grava o `mfaChallengeId` no Preferences. Nada e injetado no
  // storage por fora, entao o teste tambem cobre esse caminho.
  async function chegarAoTotp(page: Page, respostaDoVerify: unknown, status: number) {
    await page.route('**/api/v1/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          tokenType: 'Bearer',
          expiresIn: 900,
          mfaRequired: true,
          mfaChallengeId: '8c1f2a34-0000-4000-8000-000000000001',
        }),
      });
    });
    await page.route('**/api/v1/auth/totp/verify', async (route) => {
      await route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(respostaDoVerify),
      });
    });

    await page.goto('/login');
    await page.getByLabel(/e-?mail/i).fill(USUARIO);
    await page.getByLabel(/^senha/i).fill(SENHA_CORRETA);
    await page.getByRole('button', { name: /entrar/i }).click();
    await expect(page).toHaveURL(/\/login\/verify-totp$/);

    await page.getByTestId('sep-verify-totp-input').locator('input').fill('123456');
    await Promise.all([
      page.waitForResponse((res) => res.url().includes('/auth/totp/verify')),
      page.getByTestId('sep-verify-totp-submit').click(),
    ]);
  }

  test('MFA-400-004 fecha o formulario e mantem a explicacao na tela', async ({ page }) => {
    await chegarAoTotp(
      page,
      {
        timestamp: new Date().toISOString(),
        status: 400,
        error: 'Bad Request',
        // Byte a byte o que o `:8080` devolveu no smoke da M-18 (2026-09-09).
        message: 'Desafio MFA invalido ou expirado. Refaca o login.',
        path: '/api/v1/auth/totp/verify',
        codigo: 'MFA-400-004',
      },
      400,
    );

    const terminal = page.getByTestId('sep-verify-totp-terminal');
    await expect(terminal).toBeVisible();
    await expect(terminal).toContainText('Desafio MFA invalido ou expirado. Refaca o login.');
    // A armadilha que a sprint fecha: o campo de codigo nao pode continuar de pe.
    await expect(page.getByTestId('sep-verify-totp-input')).toHaveCount(0);
    // `ion-button` com `routerLink` renderiza como LINK, nao como button — e o destino e a parte
    // que importa: sem ele o usuario fica preso numa tela sem formulario e sem saida.
    const voltar = page.getByRole('link', { name: /voltar ao login/i });
    await expect(voltar).toBeVisible();
    await expect(voltar).toHaveAttribute('href', '/login');

    // O texto persiste; um toast de 3s ja teria sumido e deixado a tela sem explicacao.
    await page.waitForTimeout(3_500);
    await expect(terminal).toBeVisible();
  });

  test('MFA-400-002 mantem o formulario para nova tentativa', async ({ page }) => {
    await chegarAoTotp(
      page,
      {
        timestamp: new Date().toISOString(),
        status: 400,
        error: 'Bad Request',
        message: 'Codigo TOTP invalido.',
        path: '/api/v1/auth/totp/verify',
        codigo: 'MFA-400-002',
      },
      400,
    );

    await expect(page.getByTestId('sep-verify-totp-terminal')).toHaveCount(0);
    await expect(page.getByTestId('sep-verify-totp-input')).toBeVisible();
  });
});
