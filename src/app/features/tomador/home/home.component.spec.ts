import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { UsuarioResponse } from '../../../core/api/api.models';
import { AuthService } from '../../../core/auth/auth.service';
import { TomadorHomeComponent } from './home.component';

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
  const fixture = TestBed.createComponent(TomadorHomeComponent);
  fixture.detectChanges();
  return fixture;
}

describe('TomadorHomeComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());
  afterEach(() => vi.useRealTimers());

  it('renderiza saudacao com email do usuario', () => {
    const fixture = setup(cliente);
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[data-testid="sep-tomador-email"]')?.textContent).toContain(
      cliente.username,
    );
  });

  it('renderiza 3 cards placeholder', () => {
    const fixture = setup(cliente);
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[data-testid="sep-tomador-card-cadastro"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="sep-tomador-card-proposta"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="sep-tomador-card-parcelas"]')).not.toBeNull();
  });

  it('renderiza 3 atalhos com badge Em breve', () => {
    const fixture = setup(cliente);
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[data-testid="sep-tomador-shortcut-onboarding"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="sep-tomador-shortcut-solicitar"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="sep-tomador-shortcut-acompanhar"]')).not.toBeNull();
    const badges = el.querySelectorAll('.sep-tomador-card-badge');
    expect(badges.length).toBeGreaterThanOrEqual(6);
  });

  it('clique em atalho exibe feedback Em breve', async () => {
    vi.useFakeTimers();
    const fixture = setup(cliente);
    const el: HTMLElement = fixture.nativeElement;
    const btn = el.querySelector(
      '[data-testid="sep-tomador-shortcut-solicitar"]',
    ) as HTMLButtonElement;
    btn.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.soonMessage()).toContain('em breve');
  });
});
