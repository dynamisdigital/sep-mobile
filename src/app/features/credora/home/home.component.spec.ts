import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';

import { UsuarioResponse } from '../../../core/api/api.models';
import { AuthService } from '../../../core/auth/auth.service';
import { CredoraHomeComponent } from './home.component';

const cliente: UsuarioResponse = {
  id: '1f0799c0-98b9-6d9d-bc4a-7d6f5b771001',
  username: 'cliente@empresa.com',
  role: 'CLIENTE',
  dataCriacao: '2026-04-24T18:30:00-03:00',
  dataModificacao: '2026-04-24T18:30:00-03:00',
  criadoPor: 'system',
  modificadoPor: 'system',
};

function setup() {
  const authStub = {
    currentUser: signal<UsuarioResponse | null>(cliente) as ReturnType<typeof signal>,
  };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: AuthService, useValue: authStub }],
  });
  const fixture = TestBed.createComponent(CredoraHomeComponent);
  fixture.detectChanges();
  return fixture;
}

describe('CredoraHomeComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('renderiza saudacao da empresa credora', () => {
    const fixture = setup();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[data-testid="sep-credora-email"]')?.textContent).toContain(
      cliente.username,
    );
  });

  it('renderiza 4 cards placeholder (KYB, oportunidades, operacoes, carteira)', () => {
    const fixture = setup();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[data-testid="sep-credora-card-kyb"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="sep-credora-card-oportunidades"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="sep-credora-card-operacoes"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="sep-credora-card-carteira"]')).not.toBeNull();
  });

  it('cada card exibe badge Em breve', () => {
    const fixture = setup();
    const el: HTMLElement = fixture.nativeElement;
    const badges = el.querySelectorAll('.sep-credora-card-badge');
    expect(badges.length).toBe(4);
    badges.forEach((b) => expect(b.textContent?.trim()).toBe('Em breve'));
  });
});
