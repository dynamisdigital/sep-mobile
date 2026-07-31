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

  it('anuncia o bloqueio no titulo', () => {
    const el = renderizar();
    expect(el.querySelector('[data-testid="sep-account-locked-title"]')?.textContent).toContain(
      'Tentativas excessivas',
    );
  });

  it('atribui o bloqueio tambem ao codigo de verificacao, nao so a senha', () => {
    // LockoutService.STATUSES_FALHA conta SENHA_INVALIDA e TOTP_INVALIDO no mesmo contador, e
    // VerificarTotpUseCase chama o mesmo lockoutService.verificar.
    expect(renderizar().textContent).toContain('senha ou codigo de verificacao');
  });

  it('informa o prazo real e a partir de quando ele conta', () => {
    // PoliticaLockout.eventoDeBloqueio mede o prazo desde a falha que fecha a janela, nao desde a
    // abertura desta tela. Dizer so "alguns minutos" convidava a tentar de novo aos 5 e falhar.
    const texto = renderizar().textContent ?? '';
    expect(texto).toContain('30 minutos');
    expect(texto).toContain('ultima tentativa');
  });

  it('diz que o desbloqueio e automatico e que nao ha liberacao manual', () => {
    // Conferido que nao existe endpoint de unlock, acao de backoffice, job nem delete em
    // LoginAttemptRepository: a unica saida e a expiracao do prazo.
    const texto = renderizar().textContent ?? '';
    expect(texto).toContain('desbloqueio e automatico');
    expect(texto).toContain('nao existe liberacao manual');
  });

  // Assercao NEGATIVA, e a mais importante desta spec: a copy anterior mandava "revise os
  // dispositivos conectados". Nao existe tela de sessoes no app nem endpoint que liste dispositivos
  // no backend (o AuthController so expoe /logout e /logout-all). Este teste impede que a instrucao
  // impossivel volte numa revisao futura de texto.
  it('nao manda revisar dispositivos conectados, que o produto nao oferece', () => {
    expect(renderizar().textContent).not.toContain('dispositivos');
  });

  it('oferece volta para o login', () => {
    const link = renderizar().querySelector('[data-testid="sep-account-locked-back"]');
    expect(link).not.toBeNull();
    expect(link?.textContent).toContain('Voltar ao login');
  });
});
