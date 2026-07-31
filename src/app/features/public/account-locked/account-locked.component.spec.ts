import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';

import { AccountLockedComponent } from './account-locked.component';

// Destino do redirect de 423 nas tres camadas. A copy e o unico conteudo desta tela, entao o que ha
// para travar e que cada afirmacao continue verdadeira contra o `sep-api` — inclusive a que foi
// REMOVIDA na M-Sprint 17. Ver o doc comment do componente para a conferencia de cada uma.
describe('AccountLockedComponent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideRouter([])],
    });
  });

  function renderizar(): HTMLElement {
    const fixture = TestBed.createComponent(AccountLockedComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  // O template quebra as frases em varias linhas, entao o `textContent` vem cheio de espaco. As
  // assercoes travam a FRASE INTEIRA, e nao pedacos soltos: com `toContain('30 minutos')` e
  // `toContain('ultima tentativa')` separados, uma reescrita para "bloqueada por 30 minutos
  // contados a partir de agora. Sua ultima tentativa ficou registrada" passaria — e diria
  // exatamente a inverdade que esta sprint removeu.
  function textoNormalizado(): string {
    return (renderizar().textContent ?? '').replace(/\s+/g, ' ').trim();
  }

  // Trava so a ligacao: que o hook de entrada da pagina foca o heading. NAO prova que o foco
  // funciona de verdade — no happy-dom `focus()` pega em heading mesmo SEM `tabindex="-1"`, entao
  // este teste passaria com o atributo removido, quando em browser real o foco ficaria em <body>.
  // A prova real esta em `e2e/foco-redirect-mobile.spec.ts`, que roda em Chromium.
  it('o hook de entrada da pagina move o foco para o heading', () => {
    const fixture = TestBed.createComponent(AccountLockedComponent);
    fixture.detectChanges();
    fixture.componentInstance.ionViewDidEnter();
    const titulo = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="sep-account-locked-title"]',
    );
    expect(document.activeElement).toBe(titulo);
  });

  it('anuncia o bloqueio no titulo', () => {
    const titulo = renderizar().querySelector('[data-testid="sep-account-locked-title"]');
    expect(titulo?.textContent?.trim()).toBe('Tentativas excessivas');
  });

  it('atribui o bloqueio tambem ao codigo de verificacao, nao so a senha', () => {
    // LockoutService.STATUSES_FALHA conta SENHA_INVALIDA e TOTP_INVALIDO no mesmo contador, e
    // VerificarTotpUseCase chama o mesmo lockoutService.verificar.
    expect(textoNormalizado()).toContain(
      'tentativas de acesso malsucedidas — senha ou codigo de verificacao',
    );
  });

  it('informa o prazo real e a partir de quando ele conta', () => {
    // PoliticaLockout.eventoDeBloqueio mede o prazo desde a falha que fecha a janela, nao desde a
    // abertura desta tela. Dizer so "alguns minutos" convidava a tentar de novo aos 5 e falhar.
    expect(textoNormalizado()).toContain(
      'bloqueada por ate 30 minutos, contados a partir da ultima tentativa',
    );
  });

  it('diz que o desbloqueio e automatico e que nao ha liberacao manual', () => {
    // Conferido que nao existe endpoint de unlock, acao de backoffice, job nem delete em
    // LoginAttemptRepository: a unica saida e a expiracao do prazo.
    expect(textoNormalizado()).toContain(
      'O desbloqueio e automatico e acontece so por expiracao desse prazo: nao existe liberacao manual.',
    );
  });

  // Assercao NEGATIVA, e a mais importante desta spec: a copy anterior mandava "revise os
  // dispositivos conectados". Nao existe tela de sessoes no app nem endpoint que liste dispositivos
  // no backend (o AuthController so expoe /logout e /logout-all). O regex cobre as reescritas
  // obvias — singular, "aparelho", "sessoes ativas" —, senao trocar uma palavra devolveria a
  // instrucao impossivel sem quebrar o teste.
  it('nao manda revisar dispositivos ou sessoes, que o produto nao oferece', () => {
    expect(textoNormalizado()).not.toMatch(/dispositivo|aparelho|sess(ao|oes|ão|ões) ativ/i);
  });

  it('oferece volta para o login', () => {
    const link = renderizar().querySelector('[data-testid="sep-account-locked-back"]');
    expect(link?.textContent?.trim()).toBe('Voltar ao login');
    // O RouterLinkDelegate do Ionic renderiza o href; sem este assert, remover o `routerLink` (ou
    // apontar para outra rota) deixaria o botao inerte e o teste verde.
    expect(link?.getAttribute('href')).toBe('/login');
  });
});
