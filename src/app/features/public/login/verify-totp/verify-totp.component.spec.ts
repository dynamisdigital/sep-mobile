import { EnvironmentInjector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
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
});
