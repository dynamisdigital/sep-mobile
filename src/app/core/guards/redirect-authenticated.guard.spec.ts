import { Injector, runInInjectionContext, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from '../auth/auth.service';
import { redirectAuthenticatedGuard } from './redirect-authenticated.guard';

const fakeRouteSnapshot = {} as ActivatedRouteSnapshot;
const fakeStateSnapshot = { url: '/login' } as RouterStateSnapshot;

function runGuard(): Promise<boolean | UrlTree> {
  const injector = TestBed.inject(Injector);
  return Promise.resolve(
    runInInjectionContext(injector, () =>
      redirectAuthenticatedGuard(fakeRouteSnapshot, fakeStateSnapshot),
    ) as Promise<boolean | UrlTree>,
  ).then((value) => value);
}

describe('redirectAuthenticatedGuard', () => {
  let authStub: {
    currentUser: ReturnType<typeof signal>;
    hasToken: ReturnType<typeof vi.fn>;
    loadCurrentUser: ReturnType<typeof vi.fn>;
  };
  let router: Router;

  beforeEach(() => {
    authStub = {
      currentUser: signal<{ role: 'ADMIN' | 'CLIENTE' } | null>(null) as ReturnType<typeof signal>,
      hasToken: vi.fn(),
      loadCurrentUser: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [{ provide: AuthService, useValue: authStub }],
    });
    router = TestBed.inject(Router);
  });

  it('manda usuario em memoria para /app/inicio', async () => {
    (authStub.currentUser as unknown as { set: (v: unknown) => void }).set({ role: 'CLIENTE' });
    const result = await runGuard();
    expect(result).toEqual(router.parseUrl('/app/inicio'));
    expect(authStub.hasToken).not.toHaveBeenCalled();
  });

  it('permite acesso sem token', async () => {
    authStub.hasToken.mockResolvedValue(false);
    const result = await runGuard();
    expect(result).toBe(true);
    expect(authStub.loadCurrentUser).not.toHaveBeenCalled();
  });

  it('com token valido redireciona para /app/inicio', async () => {
    authStub.hasToken.mockResolvedValue(true);
    authStub.loadCurrentUser.mockResolvedValue({ role: 'CLIENTE' });
    const result = await runGuard();
    expect(result).toEqual(router.parseUrl('/app/inicio'));
  });

  it('com token invalido permite ver a tela publica', async () => {
    authStub.hasToken.mockResolvedValue(true);
    authStub.loadCurrentUser.mockResolvedValue(null);
    const result = await runGuard();
    expect(result).toBe(true);
  });
});
