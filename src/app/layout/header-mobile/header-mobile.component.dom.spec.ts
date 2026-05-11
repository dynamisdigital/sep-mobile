import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UsuarioResponse } from '../../core/api/api.models';
import { AuthService } from '../../core/auth/auth.service';
import { HeaderMobileComponent } from './header-mobile.component';

const cliente: UsuarioResponse = {
  id: '1f0799c0-98b9-6d9d-bc4a-7d6f5b771001',
  username: 'cliente@empresa.com',
  role: 'CLIENTE',
  dataCriacao: '2026-04-24T18:30:00-03:00',
  dataModificacao: '2026-04-24T18:30:00-03:00',
  criadoPor: 'system',
  modificadoPor: 'system',
  precisaRedefinirSenha: false,
  mfaHabilitado: false,
};

function setup() {
  const auth = {
    currentUser: signal<UsuarioResponse | null>(cliente),
    logout: vi.fn().mockResolvedValue(undefined),
  };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      { provide: AuthService, useValue: auth },
    ],
  });
  const router = TestBed.inject(Router);
  const navSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
  const fixture = TestBed.createComponent(HeaderMobileComponent);
  fixture.detectChanges();
  return { fixture, auth, navSpy };
}

describe('HeaderMobileComponent (DOM)', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('renderiza botao Sair', () => {
    const { fixture } = setup();
    const btn = fixture.nativeElement.querySelector('[data-testid="sep-header-mobile-logout"]');
    expect(btn).not.toBeNull();
  });

  it('click no Sair chama auth.logout + navega /welcome', async () => {
    const { fixture, auth, navSpy } = setup();
    const btn = fixture.nativeElement.querySelector(
      '[data-testid="sep-header-mobile-logout"]',
    ) as HTMLButtonElement;

    btn.click();
    await fixture.whenStable();

    expect(auth.logout).toHaveBeenCalled();
    expect(navSpy).toHaveBeenCalledWith('/welcome');
  });
});
