import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { UsuarioResponse } from '../../core/api/api.models';
import { AuthService } from '../../core/auth/auth.service';
import { TabsComponent } from './tabs.component';

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

function setup(role: 'ADMIN' | 'CLIENTE' | null) {
  const user = role === 'ADMIN' ? admin : role === 'CLIENTE' ? cliente : null;
  const authStub = {
    currentUser: signal<UsuarioResponse | null>(user) as ReturnType<typeof signal>,
  };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [{ provide: AuthService, useValue: authStub }],
  });
  return TestBed.createComponent(TabsComponent).componentInstance;
}

describe('TabsComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('CLIENTE ve Inicio, Propostas, Parcelas e Perfil', () => {
    const cmp = setup('CLIENTE');
    const labels = cmp.tabs().map((t) => t.label);
    expect(labels).toEqual(['Inicio', 'Propostas', 'Parcelas', 'Perfil']);
  });

  it('ADMIN ve Inicio, Perfil e Admin (sem Propostas/Parcelas)', () => {
    const cmp = setup('ADMIN');
    const labels = cmp.tabs().map((t) => t.label);
    expect(labels).toEqual(['Inicio', 'Perfil', 'Admin']);
  });

  it('sem usuario, lista de tabs vazia', () => {
    const cmp = setup(null);
    expect(cmp.tabs()).toEqual([]);
  });
});
