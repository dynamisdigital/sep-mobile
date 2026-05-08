import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';

import { UsuarioResponse } from '../../../core/api/api.models';
import { AuthService } from '../../../core/auth/auth.service';
import { HomeComponent } from './home.component';

const cliente: UsuarioResponse = {
  id: '1f0799c0-98b9-6d9d-bc4a-7d6f5b771001',
  username: 'cliente@empresa.com',
  role: 'CLIENTE',
  dataCriacao: '2026-04-24T18:30:00-03:00',
  dataModificacao: '2026-04-24T18:30:00-03:00',
  criadoPor: 'system',
  modificadoPor: 'system',
};

const admin: UsuarioResponse = { ...cliente, role: 'ADMIN', username: 'admin@empresa.com' };

function setup(role: 'ADMIN' | 'CLIENTE') {
  const user = role === 'ADMIN' ? admin : cliente;
  const authStub = {
    currentUser: signal<UsuarioResponse | null>(user) as ReturnType<typeof signal>,
  };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: AuthService, useValue: authStub }],
  });
  const fixture = TestBed.createComponent(HomeComponent);
  fixture.detectChanges();
  return fixture;
}

describe('HomeComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('CLIENTE ve atalhos de Perfil/Propostas/Parcelas', () => {
    const fixture = setup('CLIENTE');
    const labels = fixture.componentInstance.shortcuts().map((s) => s.label);
    expect(labels).toEqual(['Meu perfil', 'Propostas', 'Parcelas']);
  });

  it('ADMIN ve atalhos de Perfil e Administracao', () => {
    const fixture = setup('ADMIN');
    const labels = fixture.componentInstance.shortcuts().map((s) => s.label);
    expect(labels).toEqual(['Meu perfil', 'Administracao']);
  });

  it('renderiza email do usuario', () => {
    const fixture = setup('CLIENTE');
    const el: HTMLElement = fixture.nativeElement;
    const text = el.querySelector('[data-testid="sep-home-email"]')?.textContent ?? '';
    expect(text).toContain(cliente.username);
  });
});
