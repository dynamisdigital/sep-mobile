import { expect, test, type Page } from '@playwright/test';

// Jornada de conta bloqueada (M-Sprint 17 / backend Sprints 5 e 33), servida por MSW.
// Trava as quatro afirmacoes da DoD da spec 217 sobre o contador de falhas do mock, mais a jornada
// de UI que elas viabilizam: seis tentativas recusadas levam o usuario a /account-locked.
//
// Todas as tentativas usam um usuario EXISTENTE com senha errada, e nao um username inventado. O
// mock e mais estrito que o sep-api (conta username desconhecido, que LockoutService.STATUSES_FALHA
// descarta), entao um teste de bloqueio escrito com username inventado passaria aqui e nao
// reproduziria em producao — ver o bloco DIRECAO DO RISCO em src/mocks/handlers.ts.
const USUARIO = 'cliente@empresa.com';
const SENHA_CORRETA = 'senha-passphrase-segura';
const SENHA_ERRADA = 'senha-errada-que-nao-confere';
const LOGIN_URL = 'http://localhost:8080/api/v1/auth/login';

async function abrirComMsw(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem('NG_APP_USE_MSW', 'true');
  });
  await page.goto('/welcome');
  await page.waitForFunction(() => !!navigator.serviceWorker?.controller, { timeout: 15_000 });
}

// Chama /auth/login pelo fetch da propria pagina, que o service worker do MSW intercepta, e devolve
// so o status. As quatro afirmacoes da DoD sao sobre o CONTRATO do mock — medir pelo status, e nao
// pela tela, evita que uma mudanca de copy ou de rota mascare uma regressao no limiar.
async function tentarLogin(page: Page, username: string, password: string): Promise<number> {
  return page.evaluate(
    async ([url, u, p]) => {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: u, password: p }),
      });
      return res.status;
    },
    [LOGIN_URL, username, password],
  );
}

test.describe('M-Sprint 17 - conta bloqueada (MSW)', () => {
  test.beforeEach(async ({ page }) => {
    await abrirComMsw(page);
  });

  test('a 5a senha errada ainda responde 401; o 423 so aparece na 6a', async ({ page }) => {
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      statuses.push(await tentarLogin(page, USUARIO, SENHA_ERRADA));
    }
    // O limiar e 5 falhas (LockoutProperties.maxAttempts) e o lockout e verificado ANTES de avaliar
    // a credencial, entao a tentativa que fecha a janela ainda e recusada por credencial.
    expect(statuses).toEqual([401, 401, 401, 401, 401, 423]);
  });

  test('a senha correta apos o bloqueio tambem responde 423', async ({ page }) => {
    for (let i = 0; i < 5; i++) {
      await tentarLogin(page, USUARIO, SENHA_ERRADA);
    }
    // A credencial nem chega a ser avaliada: o bloqueio precede a resolucao do usuario.
    expect(await tentarLogin(page, USUARIO, SENHA_CORRETA)).toBe(423);
  });

  test('login bem-sucedido nao zera o contador', async ({ page }) => {
    for (let i = 0; i < 4; i++) {
      await tentarLogin(page, USUARIO, SENHA_ERRADA);
    }
    expect(await tentarLogin(page, USUARIO, SENHA_CORRETA)).toBe(200);
    // Se o sucesso zerasse, esta falha seria a 1a e as proximas cinco seriam 401.
    expect(await tentarLogin(page, USUARIO, SENHA_ERRADA)).toBe(401);
    expect(await tentarLogin(page, USUARIO, SENHA_CORRETA)).toBe(423);
  });

  test('o contador e por usuario, nao global', async ({ page }) => {
    for (let i = 0; i < 6; i++) {
      await tentarLogin(page, USUARIO, SENHA_ERRADA);
    }
    expect(await tentarLogin(page, USUARIO, SENHA_CORRETA)).toBe(423);
    // Controle positivo: outro username segue sendo recusado por credencial, nao por bloqueio.
    expect(await tentarLogin(page, 'outro@empresa.com', SENHA_ERRADA)).toBe(401);
  });

  test('seis tentativas na tela de login levam o usuario a /account-locked', async ({ page }) => {
    await page.goto('/login');
    const botao = page.getByRole('button', { name: /entrar/i });

    for (let i = 0; i < 6; i++) {
      await page.getByLabel(/e-?mail/i).fill(USUARIO);
      await page.getByLabel(/^senha/i).fill(SENHA_ERRADA);
      await Promise.all([
        page.waitForResponse((res) => res.url().includes('/auth/login')),
        botao.click(),
      ]);
      if (page.url().includes('/account-locked')) {
        break;
      }
    }

    await expect(page).toHaveURL(/\/account-locked$/);
    await expect(page.getByRole('heading', { name: /Tentativas excessivas/i })).toBeVisible();
  });
});
