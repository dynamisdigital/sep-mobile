import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AuthService } from '../auth/auth.service';
import { CredoraContextStore } from './credora-context.store';

const ME = 'http://localhost:8080/api/v1/credores/me';
const DATA = '2026-07-03T09:00:00-03:00';

describe('CredoraContextStore', () => {
  let store: CredoraContextStore;
  let httpMock: HttpTestingController;
  let auth: { currentUser: ReturnType<typeof signal<{ id: string } | null>> };

  beforeEach(() => {
    auth = { currentUser: signal<{ id: string } | null>(null) };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: auth },
      ],
    });
    store = TestBed.inject(CredoraContextStore);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('200 /me => presente + credora em memoria', async () => {
    auth.currentUser.set({ id: 'A' });
    const promise = store.carregar();
    httpMock.expectOne(ME).flush(credora('A'));
    await expect(promise).resolves.toBe('presente');

    expect(store.estado()).toBe('presente');
    expect(store.presente()).toBe(true);
    expect(store.credora()).toMatchObject({ id: 'cred-A' });
  });

  it('404 => ausente (nao e erro tecnico)', async () => {
    auth.currentUser.set({ id: 'A' });
    const promise = store.carregar();
    httpMock
      .expectOne(ME)
      .flush({ message: 'sem credora' }, { status: 404, statusText: 'Not Found' });
    await expect(promise).resolves.toBe('ausente');

    expect(store.presente()).toBe(false);
    expect(store.credora()).toBeNull();
  });

  it('5xx => erro (nunca conclui "nao e credora")', async () => {
    auth.currentUser.set({ id: 'A' });
    const promise = store.carregar();
    httpMock.expectOne(ME).flush('boom', { status: 500, statusText: 'Server Error' });
    await expect(promise).resolves.toBe('erro');

    expect(store.estado()).toBe('erro');
    expect(store.presente()).toBe(false);
  });

  it('recarregar apos erro tecnico refaz a chamada e resolve presente', async () => {
    auth.currentUser.set({ id: 'A' });
    const first = store.carregar();
    httpMock.expectOne(ME).flush('boom', { status: 500, statusText: 'Server Error' });
    await first;

    const retry = store.recarregar();
    httpMock.expectOne(ME).flush(credora('A'));
    await expect(retry).resolves.toBe('presente');
    expect(store.presente()).toBe(true);
  });

  it('deduplica chamadas concorrentes numa unica requisicao', async () => {
    auth.currentUser.set({ id: 'A' });
    const p1 = store.carregar();
    const p2 = store.carregar();
    httpMock.expectOne(ME).flush(credora('A')); // exatamente uma requisicao
    const resultados = await Promise.all([p1, p2]);
    expect(resultados).toEqual(['presente', 'presente']);
  });

  it('estado terminal conhecido nao dispara nova requisicao', async () => {
    auth.currentUser.set({ id: 'A' });
    const promise = store.carregar();
    httpMock.expectOne(ME).flush(credora('A'));
    await promise;

    await expect(store.carregar()).resolves.toBe('presente');
    httpMock.expectNone(ME);
  });

  it('troca de usuario invalida presenca/credora e refaz o fetch', async () => {
    auth.currentUser.set({ id: 'A' });
    const promise = store.carregar();
    httpMock.expectOne(ME).flush(credora('A'));
    await promise;
    expect(store.presente()).toBe(true);

    // outro usuario autentica: os signals derivados voltam a "sem credora" reativamente
    auth.currentUser.set({ id: 'B' });
    expect(store.presente()).toBe(false);
    expect(store.credora()).toBeNull();

    // carregar detecta a troca e busca para o novo usuario
    const promiseB = store.carregar();
    httpMock.expectOne(ME).flush(credora('B'));
    await expect(promiseB).resolves.toBe('presente');
    expect(store.credora()).toMatchObject({ id: 'cred-B' });
  });

  it('logout (usuario => null) zera a presenca', async () => {
    auth.currentUser.set({ id: 'A' });
    const promise = store.carregar();
    httpMock.expectOne(ME).flush(credora('A'));
    await promise;
    expect(store.presente()).toBe(true);

    auth.currentUser.set(null);
    expect(store.presente()).toBe(false);
    expect(store.credora()).toBeNull();
  });
});

function credora(sufixo: string) {
  return {
    id: `cred-${sufixo}`,
    usuarioId: sufixo,
    onboardingId: `onb-${sufixo}`,
    cnpj: '11.222.333/0001-81',
    razaoSocial: 'Credora Teste LTDA',
    status: 'ATIVA',
    elegibilidade: 'ELEGIVEL',
    motivoInelegibilidade: null,
    tipoCredora: 'EMPRESA',
    capacidadeAporte: 100000,
    dataCriacao: DATA,
    dataModificacao: DATA,
  };
}
