import { Injector, runInInjectionContext, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from '../auth/auth.service';
import { authGuard } from './auth.guard';

const fakeRouteSnapshot = {} as ActivatedRouteSnapshot;
const fakeStateSnapshot = { url: '/app/inicio' } as RouterStateSnapshot;

function runGuard(): Promise<boolean | UrlTree> {
  const injector = TestBed.inject(Injector);
  return Promise.resolve(
    runInInjectionContext(injector, () =>
      authGuard(fakeRouteSnapshot, fakeStateSnapshot),
    ) as Promise<boolean | UrlTree>,
  ).then((value) => value);
}

describe('authGuard', () => {
  let authStub: {
    currentUser: ReturnType<typeof signal>;
    hasToken: ReturnType<typeof vi.fn>;
    loadCurrentUser: ReturnType<typeof vi.fn>;
    clearSession: ReturnType<typeof vi.fn>;
  };
  let router: Router;

  beforeEach(() => {
    authStub = {
      currentUser: signal<{ role: 'ADMIN' | 'CLIENTE' } | null>(null) as ReturnType<typeof signal>,
      hasToken: vi.fn(),
      loadCurrentUser: vi.fn(),
      clearSession: vi.fn().mockResolvedValue(undefined),
    };
    TestBed.configureTestingModule({
      providers: [{ provide: AuthService, useValue: authStub }],
    });
    router = TestBed.inject(Router);
  });

  it('permite quando usuario ja esta em memoria', async () => {
    (authStub.currentUser as unknown as { set: (v: unknown) => void }).set({ role: 'CLIENTE' });
    const result = await runGuard();
    expect(result).toBe(true);
    expect(authStub.hasToken).not.toHaveBeenCalled();
  });

  it('redireciona para /welcome sem token', async () => {
    authStub.hasToken.mockResolvedValue(false);
    const result = await runGuard();
    expect(result).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(result as UrlTree)).toBe('/welcome');
  });

  it('carrega usuario quando ha token sem usuario em memoria', async () => {
    authStub.hasToken.mockResolvedValue(true);
    authStub.loadCurrentUser.mockResolvedValue({ role: 'CLIENTE' });
    const result = await runGuard();
    expect(authStub.loadCurrentUser).toHaveBeenCalled();
    expect(result).toBe(true);
  });

  it('falha em loadCurrentUser limpa sessao e redireciona /welcome', async () => {
    authStub.hasToken.mockResolvedValue(true);
    authStub.loadCurrentUser.mockResolvedValue(null);
    const result = await runGuard();
    expect(authStub.clearSession).toHaveBeenCalled();
    expect(result).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(result as UrlTree)).toBe('/welcome');
  });
});
