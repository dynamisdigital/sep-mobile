import { expect, test, type Locator, type Page } from '@playwright/test';

import { changedPassword, defaultPassword, uniqueEmail } from './fixtures/users';

// Escrito na M-Sprint 4 contra um backend real em :8080 e vermelho desde entao. A M-Sprint 17 o
// reescreveu contra o MSW, corrigindo as tres causas independentes que o mantinham quebrado:
// o seletor `link /cadastr/i`, que nunca casou com o CTA "Criar conta" (esse texto existe desde a
// M-2); a ausencia de `NG_APP_USE_MSW`, que fazia dele o unico dos 9 specs a falar com o backend; e
// as senhas do fixture, que violavam a politica e eram recusadas com 400 pelo proprio mock.
async function enableMsw(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem('NG_APP_USE_MSW', 'true');
  });
}

// O ion-router-outlet mantem as paginas anteriores no DOM (.ion-page-hidden), entao os campos de
// e-mail/senha do register e do login coexistem e o seletor por label estoura o strict mode. Mesma
// convencao de `pix-mobile.spec.ts` e `cobranca-mobile.spec.ts`.
function paginaAtiva(page: Page): Locator {
  return page.locator('.ion-page:not(.ion-page-hidden)').last();
}

async function preencherCredenciais(page: Page, email: string, senha: string): Promise<void> {
  const ativa = paginaAtiva(page);
  await ativa.getByLabel(/e-?mail/i).fill(email);
  await ativa.getByLabel(/^senha/i).fill(senha);
}

async function cadastrar(page: Page, email: string, senha: string): Promise<void> {
  await preencherCredenciais(page, email, senha);
  await paginaAtiva(page)
    .getByRole('button', { name: /cadastrar|criar/i })
    .click();
  await expect(page).toHaveURL(/\/login$/, { timeout: 10_000 });
}

async function entrar(page: Page, email: string, senha: string): Promise<void> {
  await preencherCredenciais(page, email, senha);
  await paginaAtiva(page)
    .getByRole('button', { name: /entrar|login/i })
    .click();
}

test.describe('Golden path mobile - cadastro, login, perfil, alterar senha, logout, relogin', () => {
  test.beforeEach(async ({ page }) => {
    await enableMsw(page);
  });

  // Controle positivo do fixture, no padrao que a F-Sprint 21 adotou no sep-app: prova que
  // `defaultPassword` REALMENTE atende a politica e autentica. Sem ele, uma derivacao futura no
  // fixture faria o golden path falhar la na frente, com sintoma distante da causa.
  test('a senha do fixture atende a politica e autentica', async ({ page }) => {
    const email = uniqueEmail('m17-controle');

    await page.goto('/register');
    // Cadastro aceito: a politica de senha nao recusou.
    await cadastrar(page, email, defaultPassword);

    await entrar(page, email, defaultPassword);
    await expect(page).toHaveURL(/\/app\/inicio$/, { timeout: 10_000 });
  });

  test('CLIENTE conclui golden path autenticado', async ({ page }) => {
    const email = uniqueEmail('m4-cliente');

    // 1. Splash redireciona para /welcome quando nao ha sessao
    await page.goto('/');
    await expect(page).toHaveURL(/\/welcome$/);

    // 2. Ir para cadastro. O CTA e "Criar conta" desde a M-2; o seletor original procurava
    // /cadastr/i e nunca casou.
    await paginaAtiva(page)
      .getByRole('link', { name: /criar conta/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/register$/);

    // 3. Criar usuario CLIENTE; apos o cadastro o app redireciona para o login
    await cadastrar(page, email, defaultPassword);

    // 4. Login com a senha inicial
    await entrar(page, email, defaultPassword);

    // 5. Chegar em /app/inicio com casca tomador
    await expect(page).toHaveURL(/\/app\/inicio$/, { timeout: 10_000 });
    await expect(page.getByTestId('sep-tomador-email')).toContainText(email);

    // 6. Ir para perfil via tab inferior
    await page.getByTestId('sep-tab-perfil').click();
    await expect(page).toHaveURL(/\/app\/perfil$/);
    await expect(paginaAtiva(page).getByTestId('sep-profile-email')).toContainText(email);
    await expect(paginaAtiva(page).getByTestId('sep-profile-role')).toContainText('CLIENTE');

    // 7. Abrir alterar senha
    await paginaAtiva(page).getByTestId('sep-profile-change-password').click();
    await expect(page).toHaveURL(/\/app\/perfil\/alterar-senha$/);

    // 8. Alterar senha
    const alterarSenha = paginaAtiva(page);
    await alterarSenha.getByTestId('sep-change-password-atual').fill(defaultPassword);
    await alterarSenha.getByTestId('sep-change-password-nova').fill(changedPassword);
    await alterarSenha.getByTestId('sep-change-password-confirmacao').fill(changedPassword);
    await alterarSenha.getByTestId('sep-change-password-submit').click();
    await expect(alterarSenha.getByTestId('sep-change-password-success')).toBeVisible({
      timeout: 10_000,
    });

    // 9. Voltar para perfil
    await alterarSenha.getByTestId('sep-change-password-cancel').click();
    await expect(page).toHaveURL(/\/app\/perfil$/);

    // 10. Logout
    await paginaAtiva(page).getByTestId('sep-profile-logout').click();
    await expect(page).toHaveURL(/\/welcome$/, { timeout: 10_000 });

    // 11. Relogin com a nova senha. Prova que a troca do passo 8 persistiu: a senha inicial nao
    // serve mais e a nova serve.
    await paginaAtiva(page)
      .getByRole('link', { name: /entrar|login/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/login$/);
    await entrar(page, email, changedPassword);
    await expect(page).toHaveURL(/\/app\/inicio$/, { timeout: 10_000 });
    await expect(page.getByTestId('sep-tomador-email')).toContainText(email);
  });
});
