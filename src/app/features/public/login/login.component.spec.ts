import { EnvironmentInjector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular/standalone';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from '../../../core/auth/auth.service';
import { LoginComponent } from './login.component';

function buildComponent(): LoginComponent {
  const injector = TestBed.inject(EnvironmentInjector);
  return runInInjectionContext(injector, () => new LoginComponent());
}

describe('LoginComponent', () => {
  let authSpy: { login: ReturnType<typeof vi.fn> };
  let routerSpy: { navigateByUrl: ReturnType<typeof vi.fn> };
  let toastSpy: { create: ReturnType<typeof vi.fn> };
  let toastInstance: { present: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    TestBed.resetTestingModule();
    authSpy = { login: vi.fn() };
    routerSpy = { navigateByUrl: vi.fn().mockResolvedValue(true) };
    toastInstance = { present: vi.fn().mockResolvedValue(undefined) };
    toastSpy = { create: vi.fn().mockResolvedValue(toastInstance) };
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authSpy },
        { provide: Router, useValue: routerSpy },
        { provide: ToastController, useValue: toastSpy },
      ],
    });
  });

  afterEach(() => vi.restoreAllMocks());

  it('classe esta definida', () => {
    expect(LoginComponent).toBeDefined();
  });

  it('form invalido nao chama login', async () => {
    const component = buildComponent();
    component.form.setValue({ username: '', password: '' });
    await component.submit();
    expect(authSpy.login).not.toHaveBeenCalled();
  });

  it('email invalido marca form invalido', () => {
    const component = buildComponent();
    component.form.setValue({ username: 'nao-eh-email', password: '123456' });
    expect(component.form.invalid).toBe(true);
    expect(component.form.controls.username.hasError('email')).toBe(true);
  });

  it('senha vazia invalida form', () => {
    const component = buildComponent();
    component.form.setValue({ username: 'cliente@empresa.com', password: '' });
    expect(component.form.controls.password.invalid).toBe(true);
  });

  it('credenciais validas chamam login e navegam', async () => {
    authSpy.login.mockResolvedValue({
      accessToken: 'jwt-1',
      mfaRequired: false,
      usuario: { precisaRedefinirSenha: false },
    });
    const component = buildComponent();
    component.form.setValue({
      username: 'cliente@empresa.com',
      password: 'senha-passphrase-segura',
    });
    await component.submit();
    expect(authSpy.login).toHaveBeenCalledWith({
      username: 'cliente@empresa.com',
      password: 'senha-passphrase-segura',
    });
    expect(routerSpy.navigateByUrl).toHaveBeenCalledWith('/app/inicio');
  });

  // 423 = conta bloqueada. Ramo presente desde a Sprint 5 e sem teste ate a M-Sprint 17. O
  // componente navega e retorna ANTES do toast: quem foi bloqueado nao pode ver "credenciais
  // invalidas", que sugeriria que basta tentar de novo.
  it('423 navega para /account-locked sem mostrar toast', async () => {
    const { HttpErrorResponse } = await import('@angular/common/http');
    authSpy.login.mockRejectedValue(new HttpErrorResponse({ status: 423 }));
    const component = buildComponent();
    component.form.setValue({
      username: 'cliente@empresa.com',
      password: 'senha-passphrase-segura',
    });
    await component.submit();
    expect(routerSpy.navigateByUrl).toHaveBeenCalledWith('/account-locked');
    expect(toastSpy.create).not.toHaveBeenCalled();
  });

  it('credenciais invalidas mostram toast com 401', async () => {
    const { HttpErrorResponse } = await import('@angular/common/http');
    authSpy.login.mockRejectedValue(new HttpErrorResponse({ status: 401 }));
    const component = buildComponent();
    component.form.setValue({ username: 'cliente@empresa.com', password: '999999' });
    await component.submit();
    expect(toastSpy.create).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Credenciais invalidas', color: 'danger' }),
    );
    expect(toastInstance.present).toHaveBeenCalled();
    expect(routerSpy.navigateByUrl).not.toHaveBeenCalled();
  });
});
