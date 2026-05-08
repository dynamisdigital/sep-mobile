import { Injector, runInInjectionContext, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';

import { UsuarioRole } from '../api/api.models';
import { AuthService } from '../auth/auth.service';
import { roleGuard } from './role.guard';

function makeSnapshot(roles: UsuarioRole[] | undefined): ActivatedRouteSnapshot {
  return { data: roles ? { roles } : {} } as unknown as ActivatedRouteSnapshot;
}

const fakeStateSnapshot = { url: '/app/admin' } as RouterStateSnapshot;

describe('roleGuard', () => {
  let authStub: { currentUser: ReturnType<typeof signal> };
  let router: Router;

  beforeEach(() => {
    authStub = {
      currentUser: signal<{ role: UsuarioRole } | null>(null) as ReturnType<typeof signal>,
    };
    TestBed.configureTestingModule({
      providers: [{ provide: AuthService, useValue: authStub }],
    });
    router = TestBed.inject(Router);
  });

  function run(snapshot: ActivatedRouteSnapshot): boolean | UrlTree {
    const injector = TestBed.inject(Injector);
    return runInInjectionContext(injector, () => roleGuard(snapshot, fakeStateSnapshot)) as
      | boolean
      | UrlTree;
  }

  it('permite quando rota nao exige roles', () => {
    const result = run(makeSnapshot(undefined));
    expect(result).toBe(true);
  });

  it('permite ADMIN em rota admin', () => {
    (authStub.currentUser as unknown as { set: (v: unknown) => void }).set({ role: 'ADMIN' });
    const result = run(makeSnapshot(['ADMIN']));
    expect(result).toBe(true);
  });

  it('permite CLIENTE em rota cliente', () => {
    (authStub.currentUser as unknown as { set: (v: unknown) => void }).set({ role: 'CLIENTE' });
    const result = run(makeSnapshot(['CLIENTE']));
    expect(result).toBe(true);
  });

  it('bloqueia CLIENTE em rota admin', () => {
    (authStub.currentUser as unknown as { set: (v: unknown) => void }).set({ role: 'CLIENTE' });
    const result = run(makeSnapshot(['ADMIN']));
    expect(result).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(result as UrlTree)).toBe('/access-denied');
  });

  it('bloqueia sem usuario logado', () => {
    const result = run(makeSnapshot(['ADMIN']));
    expect(result).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(result as UrlTree)).toBe('/access-denied');
  });
});
