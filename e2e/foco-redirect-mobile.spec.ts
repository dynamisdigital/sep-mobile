import { expect, test, type Page } from '@playwright/test';

// Foco nos destinos de redirect automatico (M-Sprint 17). `/account-locked` e `/access-denied` sao
// alcancados sem gesto do usuario — pelo errorInterceptor, pelo login/verify-totp e pelo roleGuard.
// O Angular nao move foco na navegacao, o app nao tem live region de rota e o `focusManagerPriority`
// do Ionic esta desligado (`provideIonicAngular()` sem config, decisao da sprint), entao sem o
// `focus()` no heading o foco fica em <body> e quem usa leitor de tela cai em silencio numa tela
// nova — justo no desfecho de um evento de seguranca.
//
// Estes testes vivem no Playwright, e nao no Vitest, por um motivo medido: no happy-dom o `focus()`
// funciona em heading SEM `tabindex="-1"`, entao o teste unitario passa mesmo com o atributo
// removido. Em browser real, heading nao e focavel sem tabindex e o `focus()` vira no-op — o
// unitario provaria uma coisa que nao acontece no device.
const DESTINOS = [
  { rota: '/account-locked', testid: 'sep-account-locked-title', texto: 'Tentativas excessivas' },
  { rota: '/access-denied', testid: 'sep-access-denied-title', texto: 'Acesso negado' },
];

async function testidDoFoco(page: Page): Promise<string | null> {
  return page.evaluate(() => document.activeElement?.getAttribute('data-testid') ?? null);
}

test.describe('M-Sprint 17 - foco nos destinos de redirect', () => {
  for (const { rota, testid, texto } of DESTINOS) {
    test(`${rota} move o foco para o heading`, async ({ page }) => {
      await page.goto(rota);
      await expect(page.getByTestId(testid)).toBeVisible();
      await expect(page.getByTestId(testid)).toHaveText(new RegExp(texto, 'i'));

      // Comparar pelo testid do elemento focado, e nao so `toBeFocused()`, deixa a falha legivel:
      // quando o foco fica em <body> o valor vem null em vez de um mismatch opaco.
      await expect.poll(() => testidDoFoco(page)).toBe(testid);

      // O `poll` sozinho so prova que o foco TOCOU o heading em algum instante: um `blur()` logo
      // depois passaria batido. Reconferir apos a transicao do Ionic assentar prova que ele
      // REPOUSA la, que e o que o leitor de tela precisa.
      await page.waitForTimeout(1_000);
      await expect(page.getByTestId(testid)).toBeFocused();
    });
  }
});
