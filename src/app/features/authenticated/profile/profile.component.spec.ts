import { Injector, runInInjectionContext, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UsuarioResponse } from '../../../core/api/api.models';
import { AuthService } from '../../../core/auth/auth.service';
import { ProfileComponent } from './profile.component';

const cliente: UsuarioResponse = {
  id: '1f0799c0-98b9-6d9d-bc4a-7d6f5b771001',
  username: 'cliente@empresa.com',
  role: 'CLIENTE',
  dataCriacao: '2026-04-24T18:30:00-03:00',
  dataModificacao: '2026-04-24T18:30:00-03:00',
  criadoPor: 'system',
  modificadoPor: 'system',
};

function createAuthStub(user: UsuarioResponse | null) {
  return {
    currentUser: signal<UsuarioResponse | null>(user) as ReturnType<typeof signal>,
    loadingUser: signal(false) as ReturnType<typeof signal>,
    loadCurrentUser: vi.fn().mockResolvedValue(user),
    logout: vi.fn().mockResolvedValue(undefined),
  };
}

function createRouterStub() {
  return { navigateByUrl: vi.fn().mockResolvedValue(true) };
}

function instantiate(
  authStub: ReturnType<typeof createAuthStub>,
  routerStub: ReturnType<typeof createRouterStub>,
): ProfileComponent {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: AuthService, useValue: authStub },
      { provide: Router, useValue: routerStub },
    ],
  });
  const injector = TestBed.inject(Injector);
  return runInInjectionContext(injector, () => new ProfileComponent());
}

describe('ProfileComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('shortId formata UUID em prefixo + sufixo', () => {
    const cmp = instantiate(createAuthStub(cliente), createRouterStub());
    expect(cmp.shortId()).toBe(`${cliente.id.slice(0, 8)}...${cliente.id.slice(-4)}`);
  });

  it('shortId vazio quando sem usuario', () => {
    const cmp = instantiate(createAuthStub(null), createRouterStub());
    expect(cmp.shortId()).toBe('');
  });

  it('reload chama AuthService.loadCurrentUser', async () => {
    const auth = createAuthStub(cliente);
    const cmp = instantiate(auth, createRouterStub());
    await cmp.reload();
    expect(auth.loadCurrentUser).toHaveBeenCalled();
  });

  it('logout chama AuthService.logout e navega /welcome', async () => {
    const auth = createAuthStub(cliente);
    const router = createRouterStub();
    const cmp = instantiate(auth, router);
    await cmp.logout();
    expect(auth.logout).toHaveBeenCalled();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/welcome');
  });

  it('user signal expoe currentUser do AuthService', () => {
    const cmp = instantiate(createAuthStub(cliente), createRouterStub());
    expect(cmp.user()).toEqual(cliente);
  });
});
