import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
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
  precisaRedefinirSenha: false,
  mfaHabilitado: false,
};

function createAuthStub() {
  return {
    currentUser: signal<UsuarioResponse | null>(cliente),
    loadingUser: signal(false),
    loadCurrentUser: vi.fn().mockResolvedValue(cliente),
    logout: vi.fn().mockResolvedValue(undefined),
  };
}

function setup() {
  const auth = createAuthStub();
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
  const fixture = TestBed.createComponent(ProfileComponent);
  fixture.detectChanges();
  return { fixture, auth, navSpy };
}

describe('ProfileComponent (DOM)', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('renderiza os tres botoes de acao', () => {
    const { fixture } = setup();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[data-testid="sep-profile-change-password"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="sep-profile-reload"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="sep-profile-logout"]')).not.toBeNull();
  });

  it('botao Recarregar chama auth.loadCurrentUser ao clicar', async () => {
    const { fixture, auth } = setup();
    const btn = fixture.nativeElement.querySelector(
      '[data-testid="sep-profile-reload"]',
    ) as HTMLButtonElement;

    btn.click();
    await fixture.whenStable();

    expect(auth.loadCurrentUser).toHaveBeenCalled();
  });

  it('botao Sair chama auth.logout + navega /welcome ao clicar', async () => {
    const { fixture, auth, navSpy } = setup();
    const btn = fixture.nativeElement.querySelector(
      '[data-testid="sep-profile-logout"]',
    ) as HTMLButtonElement;

    btn.click();
    await fixture.whenStable();

    expect(auth.logout).toHaveBeenCalled();
    expect(navSpy).toHaveBeenCalledWith('/welcome');
  });

  it('link Alterar senha tem href para /app/perfil/alterar-senha', () => {
    const { fixture } = setup();
    const link = fixture.nativeElement.querySelector(
      '[data-testid="sep-profile-change-password"]',
    ) as HTMLAnchorElement;

    expect(link).not.toBeNull();
    expect(link.getAttribute('href')).toBe('/app/perfil/alterar-senha');
  });
});
