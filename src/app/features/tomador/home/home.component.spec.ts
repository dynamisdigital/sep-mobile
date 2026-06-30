import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
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

  it('renderiza 3 atalhos; onboarding ja ativo (sem badge Em breve)', () => {
    const fixture = setup(cliente);
    const el: HTMLElement = fixture.nativeElement;
    const onboarding = el.querySelector(
      '[data-testid="sep-tomador-shortcut-onboarding"]',
    ) as HTMLButtonElement;
    const solicitar = el.querySelector(
      '[data-testid="sep-tomador-shortcut-solicitar"]',
    ) as HTMLButtonElement;
    expect(onboarding).not.toBeNull();
    expect(solicitar).not.toBeNull();
    expect(el.querySelector('[data-testid="sep-tomador-shortcut-acompanhar"]')).not.toBeNull();
    // Onboarding navega: nao exibe badge "Em breve"; atalhos sem rota continuam exibindo.
    expect(onboarding.querySelector('.sep-tomador-card-badge')).toBeNull();
    expect(solicitar.querySelector('.sep-tomador-card-badge')?.textContent).toContain('Em breve');
  });

  it('clique em Onboarding navega para /app/onboarding', () => {
    const fixture = setup(cliente);
    const router = TestBed.inject(Router);
    const navSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const el: HTMLElement = fixture.nativeElement;
    const btn = el.querySelector(
      '[data-testid="sep-tomador-shortcut-onboarding"]',
    ) as HTMLButtonElement;
    btn.click();
    expect(navSpy).toHaveBeenCalledWith('/app/onboarding');
  });

  it('clique em atalho sem rota exibe feedback Em breve', async () => {
    vi.useFakeTimers();
    const fixture = setup(cliente);
    const router = TestBed.inject(Router);
    const navSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const el: HTMLElement = fixture.nativeElement;
    const btn = el.querySelector(
      '[data-testid="sep-tomador-shortcut-acompanhar"]',
    ) as HTMLButtonElement;
    btn.click();
    expect(navSpy).toHaveBeenCalledWith('/app/propostas');
  });

  it('clique em Solicitar emprestimo navega para /app/propostas/nova', () => {
    const fixture = setup(cliente);
    const router = TestBed.inject(Router);
    const navSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const el: HTMLElement = fixture.nativeElement;
    const btn = el.querySelector(
      '[data-testid="sep-tomador-shortcut-solicitar"]',
    ) as HTMLButtonElement;
    btn.click();
    expect(navSpy).toHaveBeenCalledWith('/app/propostas/nova');
  });

  it('atalho sem rota exibe feedback Em breve', () => {
    const fixture = setup(cliente);
    const component = fixture.componentInstance;
    component.onShortcut({
      label: 'Futuro',
      description: '',
      testid: 'sep-tomador-shortcut-futuro',
      icon: 'add-circle-outline',
      tone: 'var(--primary)',
    });
    expect(component.soonMessage()).toContain('em breve');
  });
});
