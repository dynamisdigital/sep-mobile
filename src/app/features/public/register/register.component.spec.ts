import { EnvironmentInjector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular/standalone';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from '../../../core/auth/auth.service';
import { RegisterComponent } from './register.component';

function buildComponent(): RegisterComponent {
  const injector = TestBed.inject(EnvironmentInjector);
  return runInInjectionContext(injector, () => new RegisterComponent());
}

describe('RegisterComponent', () => {
  let authSpy: { register: ReturnType<typeof vi.fn> };
  let routerSpy: { navigateByUrl: ReturnType<typeof vi.fn> };
  let toastSpy: { create: ReturnType<typeof vi.fn> };
  let toastInstance: { present: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    TestBed.resetTestingModule();
    authSpy = { register: vi.fn() };
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
    expect(RegisterComponent).toBeDefined();
  });

  it('campos obrigatorios bloqueiam submit', async () => {
    const component = buildComponent();
    component.form.setValue({ username: '', password: '', role: 'CLIENTE' });
    await component.submit();
    expect(authSpy.register).not.toHaveBeenCalled();
  });

  it('email invalido bloqueia form', () => {
    const component = buildComponent();
    component.form.patchValue({ username: 'sem-arroba', password: '123456' });
    expect(component.form.controls.username.invalid).toBe(true);
  });

  it('senha vazia invalida form', () => {
    const component = buildComponent();
    component.form.patchValue({ username: 'novo@empresa.com', password: '' });
    expect(component.form.controls.password.invalid).toBe(true);
  });

  it('cadastro valido chama register e navega para login', async () => {
    authSpy.register.mockResolvedValue({ id: 'u1', username: 'novo@empresa.com' });
    const component = buildComponent();
    component.form.setValue({
      username: 'novo@empresa.com',
      password: '123456',
      role: 'CLIENTE',
    });
    await component.submit();
    expect(authSpy.register).toHaveBeenCalledWith({
      username: 'novo@empresa.com',
      password: '123456',
      role: 'CLIENTE',
    });
    expect(routerSpy.navigateByUrl).toHaveBeenCalledWith('/login');
  });

  it('email duplicado mostra toast com 409', async () => {
    const { HttpErrorResponse } = await import('@angular/common/http');
    authSpy.register.mockRejectedValue(new HttpErrorResponse({ status: 409 }));
    const component = buildComponent();
    component.form.setValue({
      username: 'duplicado@empresa.com',
      password: '123456',
      role: 'CLIENTE',
    });
    await component.submit();
    expect(toastSpy.create).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'E-mail ja cadastrado', color: 'danger' }),
    );
    expect(routerSpy.navigateByUrl).not.toHaveBeenCalled();
  });

  it('400 mostra toast generico', async () => {
    const { HttpErrorResponse } = await import('@angular/common/http');
    authSpy.register.mockRejectedValue(new HttpErrorResponse({ status: 400 }));
    const component = buildComponent();
    component.form.setValue({
      username: 'novo@empresa.com',
      password: '123456',
      role: 'CLIENTE',
    });
    await component.submit();
    expect(toastSpy.create).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Dados invalidos. Revise os campos.' }),
    );
  });
});
