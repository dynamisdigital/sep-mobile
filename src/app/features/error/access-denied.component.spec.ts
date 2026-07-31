import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';

import { UsuarioResponse } from '../../core/api/api.models';
import { AuthService } from '../../core/auth/auth.service';
import { AccessDeniedComponent } from './access-denied.component';

const cliente: UsuarioResponse = {
  id: '1f0799c0-98b9-6d9d-bc4a-7d6f5b771001',
  username: 'cliente@empresa.com',
  role: 'CLIENTE',
  dataCriacao: '2026-04-24T18:30:00-03:00',
  dataModificacao: '2026-04-24T18:30:00-03:00',
  criadoPor: 'system',
  modificadoPor: 'system',
};

function setup(user: UsuarioResponse | null) {
  const authStub = {
    currentUser: signal<UsuarioResponse | null>(user) as ReturnType<typeof signal>,
  };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: AuthService, useValue: authStub }],
  });
  const fixture = TestBed.createComponent(AccessDeniedComponent);
  fixture.detectChanges();
  return fixture;
}

describe('AccessDeniedComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('renderiza titulo', () => {
    const fixture = setup(null);
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[data-testid="sep-access-denied-title"]')?.textContent).toContain(
      'Acesso negado',
    );
  });

  // Trava a ligacao (nome do hook + elemento focado), nao a focabilidade. No happy-dom `focus()`
  // pega em heading mesmo SEM `tabindex="-1"`, entao este teste fica cego a remocao do atributo —
  // em browser real, sem ele o foco ficaria em <body>. Essa unica mutacao e coberta por
  // `e2e/foco-redirect-mobile.spec.ts`, que roda em Chromium.
  it('o hook de entrada da pagina move o foco para o heading', () => {
    const fixture = setup(null);
    fixture.componentInstance.ionViewDidEnter();
    const titulo = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="sep-access-denied-title"]',
    );
    expect(document.activeElement).toBe(titulo);
  });

  it('autenticado: link volta para /app/inicio', () => {
    const fixture = setup(cliente);
    expect(fixture.componentInstance.fallbackLink()).toBe('/app/inicio');
  });

  it('nao autenticado: link volta para /welcome', () => {
    const fixture = setup(null);
    expect(fixture.componentInstance.fallbackLink()).toBe('/welcome');
  });
});
