import { expect, test, type Locator, type Page } from '@playwright/test';

// Central de notificacoes contra os handlers MSW REAIS (M-Sprint 19, Task 219.5). Nenhum `page.route`
// aqui: sobrescrever a resposta provaria o consumidor, nao o mock. O que se prova e o que o mock
// precisa ter de fiel ao sep-api — owner-scope e canal IN_APP antes de paginar e contar, vazio como
// sucesso, 404 neutro, idempotencia da leitura e os codigos so onde o backend os publica.
//
// Contas semeadas em `src/mocks/handlers.ts`: a conta seed (12 avisos in-app, 3 nao lidos, mais um
// e-mail), a tomadora B (2 avisos proprios) e a credora sem aviso in-app (so um e-mail).
const CONTA_SEED = { username: 'cliente@empresa.com', senha: 'senha-passphrase-segura' };
const TOMADORA_B = { username: 'tomadora.b@empresa.com', senha: 'senha-notificacoes-segura' };
const CREDORA = { username: 'credora@empresa.com', senha: 'senha-notificacoes-segura' };

const AVISO_DA_CONTA_SEED = '1f0a8c2e-7d3b-6e10-9a4f-00000000a012';
const EMAIL_DA_CONTA_SEED = '1f0a8c2e-7d3b-6e10-9a4f-00000000e001';
const AVISO_INEXISTENTE = '1f0a8c2e-7d3b-6e10-9a4f-0000000ff999';
const API = 'http://localhost:8080/api/v1/notificacoes';

interface RespostaCrua {
  status: number;
  corpo: Record<string, unknown>;
}

async function entrar(page: Page, conta: { username: string; senha: string }): Promise<void> {
  await page.goto('/login');
  await page.getByLabel(/e-?mail/i).fill(conta.username);
  await page.getByLabel(/^senha/i).fill(conta.senha);
  await page.getByRole('button', { name: /entrar|login/i }).click();
  await expect(page).toHaveURL(/\/app\/inicio$/, { timeout: 10_000 });
}

// O ion-router-outlet mantem paginas escondidas no DOM, cada uma com o proprio header.
function sino(page: Page): Locator {
  return page.locator('[data-testid="sep-header-mobile-notificacoes"]:visible');
}

function central(page: Page): Locator {
  return page.locator('sep-notificacoes');
}

async function abrirCentral(page: Page): Promise<void> {
  await sino(page).click();
  await expect(page).toHaveURL(/\/app\/notificacoes$/);
  await expect(central(page).getByTestId('sep-notificacoes-carregando')).toHaveCount(0);
}

// Chamada crua ao mock pela pagina, para o que a UI nao alcanca (outro dono, e-mail, parametros).
// O service worker do MSW intercepta o `fetch` da pagina como intercepta o HttpClient.
async function chamar(
  page: Page,
  metodo: 'GET' | 'POST',
  url: string,
  autenticado = true,
): Promise<RespostaCrua> {
  return page.evaluate(
    async ({ metodo, url, autenticado }) => {
      const headers: Record<string, string> = autenticado
        ? { Authorization: 'Bearer mock-jwt-token' }
        : {};
      const resposta = await fetch(url, { method: metodo, headers });
      return { status: resposta.status, corpo: await resposta.json() };
    },
    { metodo, url, autenticado },
  );
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem('NG_APP_USE_MSW', 'true'));
});

test.describe('M-Sprint 19 - central de notificacoes contra o MSW', () => {
  test('conta seed ve so os proprios avisos in-app, paginados, e o contador exclui e-mail', async ({
    page,
  }) => {
    await entrar(page, CONTA_SEED);
    await expect(sino(page)).toHaveAttribute('aria-label', 'Notificacoes, 3 nao lidas');

    await abrirCentral(page);
    // 12 in-app do dono; o e-mail dele e os avisos da tomadora B ficariam 13 ou 15.
    await expect(central(page).getByTestId('sep-notificacoes-total')).toHaveText('12 notificacoes');
    await expect(central(page).getByTestId('sep-notificacoes-item')).toHaveCount(10);
    await expect(central(page).getByTestId('sep-notificacoes-pagina-atual')).toHaveText(
      'Pagina 1 de 2',
    );
    // Ordem do servidor: o mais recente (dia 12) primeiro.
    await expect(central(page).getByTestId('sep-notificacoes-item').first()).toContainText(
      'Recebida em 12/09/2026',
    );

    await central(page).getByTestId('sep-notificacoes-proxima').click();
    await expect(central(page).getByTestId('sep-notificacoes-pagina-atual')).toHaveText(
      'Pagina 2 de 2',
    );
    await expect(central(page).getByTestId('sep-notificacoes-item')).toHaveCount(2);
    await expect(
      central(page).getByTestId('sep-notificacoes-item-situacao').filter({ hasText: 'Nao lida' }),
    ).toHaveCount(1);
  });

  test('marcar como lida grava no mock, baixa o contador e sobrevive ao reload', async ({
    page,
  }) => {
    await entrar(page, CONTA_SEED);
    await abrirCentral(page);

    const primeiro = central(page).getByTestId('sep-notificacoes-item').first();
    await expect(primeiro.getByTestId('sep-notificacoes-item-situacao')).toHaveText('Nao lida');
    await primeiro.getByTestId('sep-notificacoes-item-marcar').click();

    await expect(primeiro.getByTestId('sep-notificacoes-item-situacao')).toContainText('Lida em');
    await expect(primeiro.getByTestId('sep-notificacoes-item-marcar')).toHaveCount(0);
    await expect(sino(page)).toHaveAttribute('aria-label', 'Notificacoes, 2 nao lidas');

    await page.reload();
    await expect(central(page).getByTestId('sep-notificacoes-item').first()).toContainText(
      'Lida em',
    );
    await expect(sino(page)).toHaveAttribute('aria-label', 'Notificacoes, 2 nao lidas');
  });

  test('marcar de novo e idempotente e devolve a primeira lidaEm', async ({ page }) => {
    await entrar(page, CONTA_SEED);

    const primeira = await chamar(page, 'POST', `${API}/${AVISO_DA_CONTA_SEED}/leitura`);
    const segunda = await chamar(page, 'POST', `${API}/${AVISO_DA_CONTA_SEED}/leitura`);

    expect(primeira.status).toBe(200);
    expect(segunda.status).toBe(200);
    expect(typeof primeira.corpo['lidaEm']).toBe('string');
    expect(segunda.corpo['lidaEm']).toBe(primeira.corpo['lidaEm']);
    expect(Object.keys(primeira.corpo).sort()).toEqual(
      ['criadaEm', 'id', 'lidaEm', 'mensagem', 'referencia', 'tipo', 'titulo'].sort(),
    );
  });

  test('outra conta nao ve nem marca aviso da conta seed, e o 404 e o mesmo de inexistente', async ({
    page,
  }) => {
    await entrar(page, TOMADORA_B);
    await expect(sino(page)).toHaveAttribute('aria-label', 'Notificacoes, 2 nao lidas');
    await abrirCentral(page);
    await expect(central(page).getByTestId('sep-notificacoes-total')).toHaveText('2 notificacoes');

    const alheio = await chamar(page, 'POST', `${API}/${AVISO_DA_CONTA_SEED}/leitura`);
    const inexistente = await chamar(page, 'POST', `${API}/${AVISO_INEXISTENTE}/leitura`);

    expect(alheio.status).toBe(404);
    expect(alheio.corpo['codigo']).toBe('NTF-404-001');
    // Neutro: fora `timestamp` e `path` (que repete a URL pedida), os dois corpos sao iguais.
    const semVariaveis = ({ timestamp, path, ...resto }: Record<string, unknown>) => {
      void timestamp;
      void path;
      return resto;
    };
    expect(semVariaveis(alheio.corpo)).toEqual(semVariaveis(inexistente.corpo));
    expect(JSON.stringify(alheio.corpo)).not.toContain(CONTA_SEED.username);
  });

  test('aviso de e-mail do proprio dono tambem e 404 neutro na leitura', async ({ page }) => {
    await entrar(page, CONTA_SEED);

    const email = await chamar(page, 'POST', `${API}/${EMAIL_DA_CONTA_SEED}/leitura`);

    expect(email.status).toBe(404);
    expect(email.corpo['codigo']).toBe('NTF-404-001');
    expect(email.corpo['path']).toBe(`/api/v1/notificacoes/${EMAIL_DA_CONTA_SEED}/leitura`);
  });

  // O caso comum da persona credora enquanto so o desembolso do tomador notifica.
  test('credora sem aviso in-app ve o vazio e o contador zero, nao erro', async ({ page }) => {
    await entrar(page, CREDORA);
    await expect(sino(page)).toHaveAttribute('aria-label', 'Notificacoes, nenhuma nao lida');

    await abrirCentral(page);
    await expect(central(page).getByTestId('sep-notificacoes-vazio')).toContainText(
      'Voce nao tem notificacoes.',
    );
    await expect(central(page).getByTestId('sep-notificacoes-erro')).toHaveCount(0);
  });

  test('sair e entrar com outra conta nao herda contador nem lista', async ({ page }) => {
    await entrar(page, CONTA_SEED);
    await abrirCentral(page);
    await expect(central(page).getByTestId('sep-notificacoes-total')).toHaveText('12 notificacoes');

    await page.locator('[data-testid="sep-header-mobile-logout"]:visible').click();
    await expect(page).toHaveURL(/\/welcome$/);

    await entrar(page, TOMADORA_B);
    await expect(sino(page)).toHaveAttribute('aria-label', 'Notificacoes, 2 nao lidas');
    await abrirCentral(page);
    await expect(central(page).getByTestId('sep-notificacoes-total')).toHaveText('2 notificacoes');
  });

  test('401 sem token e 400 de paginacao so com codigo onde o backend publica', async ({
    page,
  }) => {
    await entrar(page, CONTA_SEED);

    const semToken = await chamar(page, 'GET', `${API}/nao-lidas/contagem`, false);
    expect(semToken.status).toBe(401);
    expect(semToken.corpo['codigo']).toBeUndefined();

    const faixa = await chamar(page, 'GET', `${API}?page=0&size=0`);
    expect(faixa.status).toBe(400);
    expect(faixa.corpo['codigo']).toBe('NTF-400-001');

    const naoNumero = await chamar(page, 'GET', `${API}?page=abc&size=10`);
    expect(naoNumero.status).toBe(400);
    expect(naoNumero.corpo['codigo']).toBeUndefined();

    const idInvalido = await chamar(page, 'POST', `${API}/nao-e-uuid/leitura`);
    expect(idInvalido.status).toBe(400);
    expect(idInvalido.corpo['codigo']).toBeUndefined();
  });
});
