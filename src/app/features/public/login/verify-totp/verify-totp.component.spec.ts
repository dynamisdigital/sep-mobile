import { HttpErrorResponse } from '@angular/common/http';
import { EnvironmentInjector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { ToastController } from '@ionic/angular/standalone';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from '../../../../core/auth/auth.service';
import { BiometricService } from '../../../../core/auth/biometric.service';
import { MfaService } from '../../../../core/auth/mfa.service';
import { VerifyTotpComponent } from './verify-totp.component';

function buildComponent(): VerifyTotpComponent {
  const injector = TestBed.inject(EnvironmentInjector);
  return runInInjectionContext(injector, () => new VerifyTotpComponent());
}

// Segunda camada da jornada de conta bloqueada: o backend conta SENHA_INVALIDA e TOTP_INVALIDO no
// MESMO contador por username (LockoutService.STATUSES_FALHA), entao errar o TOTP tambem bloqueia e
// VerificarTotpUseCase responde 423. O componente trata isso desde a M-Sprint 5 e nao tinha spec
// nenhuma ate a M-Sprint 17.
describe('VerifyTotpComponent', () => {
  let authSpy: {
    hydratePendingMfa: ReturnType<typeof vi.fn>;
    pendingMfaChallenge: ReturnType<typeof vi.fn>;
    applyMfaVerifyResponse: ReturnType<typeof vi.fn>;
    descartarDesafioMfa: ReturnType<typeof vi.fn>;
  };
  let mfaSpy: { verify: ReturnType<typeof vi.fn> };
  let biometricSpy: {
    checkAvailability: ReturnType<typeof vi.fn>;
    authenticate: ReturnType<typeof vi.fn>;
  };
  let routerSpy: { navigateByUrl: ReturnType<typeof vi.fn> };
  let toastSpy: { create: ReturnType<typeof vi.fn> };
  let toastInstance: { present: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    TestBed.resetTestingModule();
    authSpy = {
      hydratePendingMfa: vi.fn().mockResolvedValue(undefined),
      pendingMfaChallenge: vi.fn().mockReturnValue('challenge-1'),
      applyMfaVerifyResponse: vi.fn().mockResolvedValue(undefined),
      descartarDesafioMfa: vi.fn().mockResolvedValue(undefined),
    };
    mfaSpy = { verify: vi.fn() };
    biometricSpy = {
      checkAvailability: vi.fn().mockResolvedValue(false),
      authenticate: vi.fn().mockResolvedValue(false),
    };
    routerSpy = { navigateByUrl: vi.fn().mockResolvedValue(true) };
    toastInstance = { present: vi.fn().mockResolvedValue(undefined) };
    toastSpy = { create: vi.fn().mockResolvedValue(toastInstance) };
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authSpy },
        { provide: MfaService, useValue: mfaSpy },
        { provide: BiometricService, useValue: biometricSpy },
        { provide: Router, useValue: routerSpy },
        { provide: ToastController, useValue: toastSpy },
      ],
    });
  });

  afterEach(() => vi.restoreAllMocks());

  function componenteComCodigo(codigo = '123456'): VerifyTotpComponent {
    const component = buildComponent();
    component.form.setValue({ codigo });
    return component;
  }

  it('423 navega para /account-locked sem mostrar toast', async () => {
    const { HttpErrorResponse } = await import('@angular/common/http');
    mfaSpy.verify.mockRejectedValue(new HttpErrorResponse({ status: 423 }));
    const component = componenteComCodigo();

    await component.submit();

    expect(routerSpy.navigateByUrl).toHaveBeenCalledWith('/account-locked');
    // Quem foi bloqueado nao pode ver "codigo invalido", que sugeriria bastar tentar outro codigo.
    expect(toastSpy.create).not.toHaveBeenCalled();
  });

  // Controle negativo: codigo errado nao e conta bloqueada. Sem ele, um ramo que navegasse para
  // /account-locked em QUALQUER erro passaria no teste acima.
  it('codigo invalido mostra toast e nao navega', async () => {
    const { HttpErrorResponse } = await import('@angular/common/http');
    mfaSpy.verify.mockRejectedValue(new HttpErrorResponse({ status: 401 }));
    const component = componenteComCodigo('000000');

    await component.submit();

    // Sem corpo utilizavel, o fallback local. A M-18 passou a preferir a copy do backend quando ela
    // existe; aqui ela nao existe, e o texto tem de continuar sendo este.
    expect(toastSpy.create).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Codigo invalido ou challenge expirado.' }),
    );
    expect(toastInstance.present).toHaveBeenCalled();
    expect(routerSpy.navigateByUrl).not.toHaveBeenCalled();
  });

  it('codigo valido conclui o login', async () => {
    const response = { accessToken: 'jwt-1', usuario: { precisaRedefinirSenha: false } };
    mfaSpy.verify.mockResolvedValue(response);
    const component = componenteComCodigo();

    await component.submit();

    expect(mfaSpy.verify).toHaveBeenCalledWith({ mfaChallengeId: 'challenge-1', codigo: '123456' });
    // Com argumento: sem ele, entregar um payload vazio a sessao passaria no teste.
    expect(authSpy.applyMfaVerifyResponse).toHaveBeenCalledWith(response);
    expect(routerSpy.navigateByUrl).toHaveBeenCalledWith('/app/inicio');
  });

  // O `ngOnInit` e o que recupera o challenge ao reabrir o app; sem esta cobertura o corpo dele
  // podia ser esvaziado inteiro sem quebrar nenhum teste, e os stubs de hydrate/biometria eram
  // setup morto.
  it('ngOnInit recupera o challenge pendente e consulta a biometria', async () => {
    biometricSpy.checkAvailability.mockResolvedValue(true);
    const component = buildComponent();

    await component.ngOnInit();

    expect(authSpy.hydratePendingMfa).toHaveBeenCalled();
    expect(component.challengeAusente()).toBe(false);
    expect(component.biometriaDisponivel()).toBe(true);
  });

  it('ngOnInit sem challenge sinaliza a ausencia e nem consulta a biometria', async () => {
    authSpy.pendingMfaChallenge.mockReturnValue(null);
    const component = buildComponent();

    await component.ngOnInit();

    expect(component.challengeAusente()).toBe(true);
    expect(biometricSpy.checkAvailability).not.toHaveBeenCalled();
  });

  it('form invalido nao chama verify', async () => {
    const component = componenteComCodigo('');

    await component.submit();

    expect(mfaSpy.verify).not.toHaveBeenCalled();
  });

  it('sem challenge pendente nao chama verify e sinaliza a ausencia', async () => {
    authSpy.pendingMfaChallenge.mockReturnValue(null);
    const component = componenteComCodigo();

    await component.submit();

    expect(mfaSpy.verify).not.toHaveBeenCalled();
    expect(component.challengeAusente()).toBe(true);
  });

  // ---------------------------------------------------------------------------------------------
  // M-Sprint 18: o `400` deixa de ser um desfecho so. O codigo escolhe o RAMO; a frase continua
  // vindo do corpo. Ordem real medida no `VerificarTotpUseCase`: bean validation (SEM codigo) ->
  // 004 (consumir desafio) -> 423 (lockout) -> 003 (secret ausente/inativo) -> 002 (codigo errado).
  // ---------------------------------------------------------------------------------------------
  async function erro400(codigo: string | undefined, message = 'Mensagem do backend.') {
    const { HttpErrorResponse } = await import('@angular/common/http');
    const corpo: Record<string, unknown> = { message, status: 400 };
    if (codigo !== undefined) {
      corpo['codigo'] = codigo;
    }
    return new HttpErrorResponse({ status: 400, error: corpo });
  }

  it.each([
    ['MFA-400-003', 'conta sem TOTP ativo'],
    ['MFA-400-004', 'desafio expirado ou ja consumido'],
  ])('%s encerra a tentativa e descarta o desafio (%s)', async (codigo) => {
    mfaSpy.verify.mockRejectedValue(await erro400(codigo, 'Desafio invalido ou expirado.'));
    const component = componenteComCodigo();

    await component.submit();

    expect(component.challengeAusente()).toBe(true);
    expect(component.mensagemTerminal()).toBe('Desafio invalido ou expirado.');
    // A frase fica NA TELA. Um toast de 3s desapareceria e deixaria o formulario fechado sem
    // explicacao — o motivo de este ramo nao usar toast.
    expect(toastSpy.create).not.toHaveBeenCalled();
    // Sem descartar, o `hydratePendingMfa` de uma reentrada ressuscitaria o desafio morto.
    expect(authSpy.descartarDesafioMfa).toHaveBeenCalled();
    expect(routerSpy.navigateByUrl).not.toHaveBeenCalled();
  });

  it('MFA-400-002 mantem o formulario e permite nova tentativa', async () => {
    mfaSpy.verify.mockRejectedValue(await erro400('MFA-400-002', 'Codigo invalido.'));
    const component = componenteComCodigo();

    await component.submit();

    // O `VerificarTotpUseCase` chama `challengeService.devolver(...)` antes de lancar aqui: o
    // desafio segue vivo e redigitar e a acao certa.
    expect(component.challengeAusente()).toBe(false);
    expect(component.mensagemTerminal()).toBeNull();
    expect(authSpy.descartarDesafioMfa).not.toHaveBeenCalled();
    expect(toastSpy.create).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Codigo invalido.' }),
    );

    // E a nova tentativa realmente acontece — a guarda de `challengeAusente` nao pode ter fechado.
    mfaSpy.verify.mockResolvedValue({ accessToken: 'jwt-1' });
    await component.submit();
    expect(mfaSpy.verify).toHaveBeenCalledTimes(2);
  });

  // O caso que a §Ancora 2 da spec 126 errava e o smoke da F-26 corrigiu: `@NotBlank` na fronteira
  // do controller reprova ANTES do use case e responde sem campo `codigo`.
  it.each([
    ['ausente (bean validation)', undefined],
    ['desconhecido, criado por sprint futura', 'XYZ-999-001'],
    ['em branco', '   '],
  ])('codigo %s preserva o comportamento legado por status', async (_rotulo, codigo) => {
    mfaSpy.verify.mockRejectedValue(await erro400(codigo, 'codigo nao deve estar em branco'));
    const component = componenteComCodigo();

    await component.submit();

    expect(component.challengeAusente()).toBe(false);
    expect(component.mensagemTerminal()).toBeNull();
    expect(toastSpy.create).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'codigo nao deve estar em branco' }),
    );
  });

  it('codigo nao-string nao lanca e cai no legado', async () => {
    const { HttpErrorResponse } = await import('@angular/common/http');
    mfaSpy.verify.mockRejectedValue(
      new HttpErrorResponse({ status: 400, error: { message: 'x', codigo: 400 } }),
    );
    const component = componenteComCodigo();

    await expect(component.submit()).resolves.toBeUndefined();

    expect(component.challengeAusente()).toBe(false);
    // O `finally` roda: sem a guarda de tipo no helper, o `.trim()` lancaria aqui e a tela ficaria
    // presa em "enviando" para sempre.
    expect(component.submitting()).toBe(false);
  });

  it('terminal sem message utilizavel usa o fallback local, nunca texto vazio', async () => {
    mfaSpy.verify.mockRejectedValue(await erro400('MFA-400-004', '   '));
    const component = componenteComCodigo();

    await component.submit();

    expect(component.mensagemTerminal()).toBe(
      'Este desafio nao pode mais ser usado. Refaca o login.',
    );
  });

  it('depois do desfecho terminal, submit programatico nao chama verify de novo', async () => {
    mfaSpy.verify.mockRejectedValue(await erro400('MFA-400-004'));
    const component = componenteComCodigo();

    await component.submit();
    expect(mfaSpy.verify).toHaveBeenCalledTimes(1);

    // Esconder o formulario no template nao basta: `submit()` segue alcancavel.
    component.form.setValue({ codigo: '654321' });
    await component.submit();

    expect(mfaSpy.verify).toHaveBeenCalledTimes(1);
  });

  it('depois do desfecho terminal, a biometria nao e mais oferecida', async () => {
    mfaSpy.verify.mockRejectedValue(await erro400('MFA-400-003'));
    const component = componenteComCodigo();

    await component.submit();
    await component.tentarBiometria();

    expect(biometricSpy.authenticate).not.toHaveBeenCalled();
  });

  it('423 com codigo continua navegando, sem virar desfecho terminal', async () => {
    const { HttpErrorResponse } = await import('@angular/common/http');
    mfaSpy.verify.mockRejectedValue(
      new HttpErrorResponse({
        status: 423,
        error: { message: 'Conta bloqueada.', codigo: 'AUTH-423-001' },
      }),
    );
    const component = componenteComCodigo();

    await component.submit();

    expect(routerSpy.navigateByUrl).toHaveBeenCalledWith('/account-locked');
    expect(component.challengeAusente()).toBe(false);
    expect(authSpy.descartarDesafioMfa).not.toHaveBeenCalled();
  });
});

/**
 * `ion-input` chama `observe(...)` no `connectedCallback` e o happy-dom entrega `MutationObserver`
 * e `IntersectionObserver` como funcoes cujas INSTANCIAS nao tem `observe` — o erro que aparece e
 * `TypeError: n.observe is not a function`, dentro do custom element, nao no nosso codigo.
 * (`ResizeObserver` do happy-dom esta completo e nao entra aqui.)
 *
 * Escopo local de proposito: nenhum outro spec deste repo renderiza `ion-input`, entao poluir o
 * `test-setup.ts` global mudaria o ambiente de 70 arquivos para servir a um. Se um segundo spec
 * precisar, ai sim promove.
 */
function instalarObserversDeTeste(): () => void {
  const originais = new Map<string, unknown>();
  for (const nome of ['MutationObserver', 'IntersectionObserver']) {
    const global = globalThis as Record<string, unknown>;
    originais.set(nome, global[nome]);
    global[nome] = class {
      observe(): void {
        // No-op de proposito: o `ion-input` so precisa que o metodo EXISTA para completar o
        // `connectedCallback`. Nada neste spec depende de notificacao de mutacao ou de interseccao.
      }
      unobserve(): void {
        // Simetrico ao `observe`: nada foi registrado, nada ha para cancelar.
      }
      disconnect(): void {
        // Chamado no teardown do custom element.
      }
      takeRecords(): unknown[] {
        return [];
      }
    };
  }
  return () => {
    for (const [nome, valor] of originais) {
      (globalThis as Record<string, unknown>)[nome] = valor;
    }
  };
}

// ---------------------------------------------------------------------------------------------
// Prova no DOM. O bloco acima verifica signals; estes verificam o que a pessoa VE. Sem eles, um
// template que ignorasse `mensagemTerminal` passaria em tudo la em cima.
// ---------------------------------------------------------------------------------------------
describe('VerifyTotpComponent (template)', () => {
  function montar(challenge: string | null = 'challenge-1') {
    const authStub = {
      hydratePendingMfa: vi.fn().mockResolvedValue(undefined),
      pendingMfaChallenge: vi.fn().mockReturnValue(challenge),
      applyMfaVerifyResponse: vi.fn().mockResolvedValue(undefined),
      descartarDesafioMfa: vi.fn().mockResolvedValue(undefined),
    };
    const mfaStub = { verify: vi.fn() };
    const biometricStub = {
      checkAvailability: vi.fn().mockResolvedValue(false),
      authenticate: vi.fn().mockResolvedValue(false),
    };
    const toastStub = {
      create: vi.fn().mockResolvedValue({ present: vi.fn().mockResolvedValue(undefined) }),
    };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authStub },
        { provide: MfaService, useValue: mfaStub },
        { provide: BiometricService, useValue: biometricStub },
        { provide: ToastController, useValue: toastStub },
      ],
    });
    const fixture = TestBed.createComponent(VerifyTotpComponent);
    fixture.detectChanges();
    return { fixture, authStub, mfaStub };
  }

  const formulario = (f: ReturnType<typeof montar>['fixture']) =>
    f.nativeElement.querySelector('form');
  const terminal = (f: ReturnType<typeof montar>['fixture']) =>
    f.nativeElement.querySelector('[data-testid="sep-verify-totp-terminal"]');
  const voltarAoLogin = (f: ReturnType<typeof montar>['fixture']) =>
    [...f.nativeElement.querySelectorAll('ion-button')].find((b: Element) =>
      (b.textContent ?? '').includes('Voltar ao login'),
    );

  let restaurarObservers: () => void;
  beforeEach(() => {
    restaurarObservers = instalarObserversDeTeste();
  });
  afterEach(() => {
    restaurarObservers();
    vi.restoreAllMocks();
  });

  it('com desafio pendente, renderiza o formulario e nenhum bloco terminal', () => {
    const { fixture } = montar();
    expect(formulario(fixture)).not.toBeNull();
    expect(terminal(fixture)).toBeNull();
  });

  it('MFA-400-004 remove o formulario, mostra a frase do backend e o retorno ao login', async () => {
    const { fixture, mfaStub } = montar();
    mfaStub.verify.mockRejectedValue(
      new HttpErrorResponse({
        status: 400,
        error: { message: 'Desafio expirado. Refaca o login.', codigo: 'MFA-400-004' },
      }),
    );
    const cmp = fixture.componentInstance;
    cmp.form.setValue({ codigo: '123456' });

    await cmp.submit();
    fixture.detectChanges();

    expect(formulario(fixture)).toBeNull();
    const bloco = terminal(fixture);
    expect(bloco).not.toBeNull();
    expect(bloco.textContent).toContain('Desafio expirado. Refaca o login.');
    // O texto fixo do ramo local NAO pode aparecer aqui: quem tem conta sem TOTP nao resolve
    // "refazendo o login para receber um novo desafio".
    expect(fixture.nativeElement.textContent).not.toContain('Sessao expirada');
    expect(voltarAoLogin(fixture)).toBeDefined();
  });

  it('MFA-400-002 mantem o formulario na tela', async () => {
    const { fixture, mfaStub } = montar();
    mfaStub.verify.mockRejectedValue(
      new HttpErrorResponse({
        status: 400,
        error: { message: 'Codigo invalido.', codigo: 'MFA-400-002' },
      }),
    );
    const cmp = fixture.componentInstance;
    cmp.form.setValue({ codigo: '000000' });

    await cmp.submit();
    fixture.detectChanges();

    expect(formulario(fixture)).not.toBeNull();
    expect(terminal(fixture)).toBeNull();
  });

  it('sem desafio pendente mantem a copy local, sem bloco terminal', async () => {
    const { fixture } = montar(null);
    await fixture.componentInstance.ngOnInit();
    fixture.detectChanges();

    expect(formulario(fixture)).toBeNull();
    expect(terminal(fixture)).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Sessao expirada');
    expect(voltarAoLogin(fixture)).toBeDefined();
  });
});
