import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';

import { UsuarioResponse } from '../../core/api/api.models';
import { AuthService } from '../../core/auth/auth.service';
import { CredoraContextStore } from '../../core/credores/credora-context.store';
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

function setup(role: 'ADMIN' | 'CLIENTE' | null, credoraPresente = false) {
  const user = role === 'ADMIN' ? admin : role === 'CLIENTE' ? cliente : null;
  const authStub = {
    currentUser: signal<UsuarioResponse | null>(user) as ReturnType<typeof signal>,
  };
  const storeStub = {
    presente: signal(credoraPresente),
    carregar: async () => (credoraPresente ? 'presente' : 'ausente'),
  };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: authStub },
      { provide: CredoraContextStore, useValue: storeStub },
    ],
  });
  return TestBed.createComponent(TabsComponent).componentInstance;
}

describe('TabsComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('CLIENTE sem credora ve Inicio, Propostas, Parcelas e Perfil', () => {
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

  it('CLIENTE com credora presente ganha a tab Credora antes de Perfil', () => {
    const cmp = setup('CLIENTE', true);
    const labels = cmp.tabs().map((t) => t.label);
    expect(labels).toEqual(['Inicio', 'Propostas', 'Parcelas', 'Credora', 'Perfil']);
  });

  it('presenca ausente/desconhecida nao exibe a tab Credora', () => {
    const cmp = setup('CLIENTE', false);
    expect(cmp.tabs().map((t) => t.tab)).not.toContain('credora');
  });
});
