import { EnvironmentInjector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PageResponse, PropostaResponse } from '../../../core/api/api.models';
import { CreditoMobileService } from '../../../core/credito/credito-mobile.service';
import { PropostasListComponent } from './propostas-list.component';

const ID = '1f0799c0-98b9-6d9d-bc4a-7d6f5b771001';

// Convencao do repo (M-6): componentes com `ion-select`/`ion-refresher` nao montam no
// happy-dom (CSSStyleSheet.replaceSync). Testamos a logica por instancia; o render real e
// coberto pelo smoke Playwright PWA na Task M-7.6.
function setup(listarPropostas = vi.fn().mockResolvedValue(pagina([]))) {
  const stub = { listarPropostas };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: CreditoMobileService, useValue: stub }],
  });
  const injector = TestBed.inject(EnvironmentInjector);
  const component = runInInjectionContext(injector, () => new PropostasListComponent());
  return { component, stub };
}

function proposta(over: Partial<PropostaResponse> = {}): PropostaResponse {
  return {
    id: ID,
    tomadorId: '2f0799c0-98b9-6d9d-bc4a-7d6f5b772002',
    solicitacaoOnboardingId: ID,
    tipoOperacao: 'CAPITAL_GIRO',
    valorSolicitado: 10000,
    moeda: 'BRL',
    prazoMeses: 12,
    status: 'EM_ANALISE',
    dataCriacao: '2026-06-30T09:00:00-03:00',
    dataModificacao: '2026-06-30T09:00:00-03:00',
    score: null,
    parecer: null,
    ...over,
  };
}

function pagina(content: PropostaResponse[], last = true): PageResponse<PropostaResponse> {
  return {
    content,
    totalElements: content.length,
    totalPages: last ? 1 : 2,
    number: 0,
    size: 20,
    first: true,
    last,
    numberOfElements: content.length,
    empty: content.length === 0,
  };
}

describe('PropostasListComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('carregar() chama listarPropostas com page/size e sem status quando TODAS', async () => {
    const { component, stub } = setup();
    await component.carregar();
    expect(stub.listarPropostas).toHaveBeenCalledWith({ page: 0, size: 20 });
  });

  it('carregar() popula propostas e ultimaPagina, sem erro (estado lista)', async () => {
    const { component } = setup(vi.fn().mockResolvedValue(pagina([proposta()], true)));
    await component.carregar();
    expect(component.propostas()).toHaveLength(1);
    expect(component.ultimaPagina()).toBe(true);
    expect(component.erro()).toBeNull();
    expect(component.carregando()).toBe(false);
  });

  it('carregar() sem itens fica em estado vazio (lista vazia, sem erro)', async () => {
    const { component } = setup(vi.fn().mockResolvedValue(pagina([])));
    await component.carregar();
    expect(component.propostas()).toHaveLength(0);
    expect(component.erro()).toBeNull();
  });

  it('carregar() marca carregando enquanto a chamada nao resolve', () => {
    const { component } = setup(vi.fn().mockReturnValue(new Promise<never>(() => undefined)));
    void component.carregar();
    expect(component.carregando()).toBe(true);
  });

  it('carregar() em erro limpa lista e expoe mensagem com retry', async () => {
    const listar = vi.fn().mockRejectedValueOnce(new Error('falha')).mockResolvedValue(pagina([]));
    const { component } = setup(listar);
    await component.carregar();
    expect(component.propostas()).toHaveLength(0);
    expect(component.erro()).toContain('Nao foi possivel carregar');
    await component.carregar();
    expect(listar).toHaveBeenCalledTimes(2);
    expect(component.erro()).toBeNull();
  });

  it('aplicarFiltro recarrega enviando o status selecionado', async () => {
    const { component, stub } = setup();
    component.aplicarFiltro('APROVADA');
    await Promise.resolve();
    expect(component.filtroStatus()).toBe('APROVADA');
    expect(stub.listarPropostas).toHaveBeenCalledWith({ page: 0, size: 20, status: 'APROVADA' });
  });

  it('carregarMais envia a proxima pagina e acumula os itens', async () => {
    const listar = vi
      .fn()
      .mockResolvedValueOnce(pagina([proposta({ id: 'a' })], false))
      .mockResolvedValueOnce(pagina([proposta({ id: 'b' })], true));
    const { component } = setup(listar);
    await component.carregar();
    await component.carregarMais();
    expect(listar).toHaveBeenLastCalledWith({ page: 1, size: 20 });
    expect(component.propostas().map((p) => p.id)).toEqual(['a', 'b']);
    expect(component.ultimaPagina()).toBe(true);
  });

  it('ignora resposta obsoleta quando um novo carregar comeca antes da anterior resolver', async () => {
    let resolveA: (p: PageResponse<PropostaResponse>) => void = () => undefined;
    let resolveB: (p: PageResponse<PropostaResponse>) => void = () => undefined;
    const listar = vi
      .fn()
      .mockReturnValueOnce(new Promise<PageResponse<PropostaResponse>>((r) => (resolveA = r)))
      .mockReturnValueOnce(new Promise<PageResponse<PropostaResponse>>((r) => (resolveB = r)));
    const { component } = setup(listar);

    const primeira = component.carregar();
    const segunda = component.carregar();
    resolveB(pagina([proposta({ id: 'b' })]));
    await segunda;
    resolveA(pagina([proposta({ id: 'a' })]));
    await primeira;

    expect(component.propostas().map((p) => p.id)).toEqual(['b']);
  });

  it('carregarMais nao chama o backend quando ja esta na ultima pagina', async () => {
    const { component, stub } = setup(vi.fn().mockResolvedValue(pagina([proposta()], true)));
    await component.carregar();
    stub.listarPropostas.mockClear();
    await component.carregarMais();
    expect(stub.listarPropostas).not.toHaveBeenCalled();
  });

  it('abrirDetalhe navega para /app/propostas/:id', () => {
    const { component } = setup();
    const router = TestBed.inject(Router);
    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    component.abrirDetalhe('xyz');
    expect(navSpy).toHaveBeenCalledWith(['/app/propostas', 'xyz']);
  });

  it('mapeia o rotulo do tipo de operacao (status fica no sep-proposta-status)', () => {
    const { component } = setup();
    const view = component as unknown as { rotuloTipo(t: 'CAPITAL_GIRO' | 'OUTROS'): string };
    expect(view.rotuloTipo('CAPITAL_GIRO')).toBe('Capital de giro');
    expect(view.rotuloTipo('OUTROS')).toBe('Outros');
  });
});
