import { EnvironmentInjector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PageResponse, PropostaResponse } from '../../../core/api/api.models';
import { CreditoMobileService } from '../../../core/credito/credito-mobile.service';
import { ParcelasEntryComponent } from './parcelas-entry.component';

const PROPOSTA_ID = '2f0799c0-98b9-6d9d-bc4a-7d6f5b772001';

// Instance-based: Ionic (ion-content/ion-refresher) nao monta no happy-dom. Assercoes de UI
// renderizada ficam no smoke Playwright (M-9.6).
function setup(opts: { listarPropostas?: ReturnType<typeof vi.fn> } = {}) {
  const credito = {
    listarPropostas: opts.listarPropostas ?? vi.fn().mockResolvedValue(pagina([propostaFixture()])),
  };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: CreditoMobileService, useValue: credito }],
  });
  const injector = TestBed.inject(EnvironmentInjector);
  const component = runInInjectionContext(injector, () => new ParcelasEntryComponent());
  return { component, credito };
}

describe('ParcelasEntryComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('carrega apenas propostas APROVADAS (aptas a ter agenda) sem enviar tomadorId', async () => {
    const { component, credito } = setup();
    await component.carregar();
    expect(credito.listarPropostas).toHaveBeenCalledWith({
      status: 'APROVADA',
      page: 0,
      size: 20,
    });
    expect(component.propostas()).toHaveLength(1);
    expect(component.carregando()).toBe(false);
  });

  it('nao consulta contrato/agenda por item da lista (sem N+1)', async () => {
    const { component, credito } = setup({
      listarPropostas: vi
        .fn()
        .mockResolvedValue(pagina([propostaFixture('a'), propostaFixture('b')])),
    });
    await component.carregar();
    // Unica chamada de rede: a listagem. Nenhuma consulta de contrato/agenda por item.
    expect(credito.listarPropostas).toHaveBeenCalledTimes(1);
  });

  it('lista vazia e um estado valido (sem erro, nao significa divida quitada)', async () => {
    const { component } = setup({ listarPropostas: vi.fn().mockResolvedValue(pagina([])) });
    await component.carregar();
    expect(component.propostas()).toEqual([]);
    expect(component.erro()).toBeNull();
  });

  it('erro na carga expoe mensagem de retry e zera a lista', async () => {
    const { component } = setup({ listarPropostas: vi.fn().mockRejectedValue(new Error('rede')) });
    await component.carregar();
    expect(component.propostas()).toEqual([]);
    expect(component.erro()).toContain('Tente novamente');
  });

  it('carregarMais acumula a proxima pagina e respeita ultimaPagina', async () => {
    const listarPropostas = vi
      .fn()
      .mockResolvedValueOnce(pagina([propostaFixture('a')], false))
      .mockResolvedValueOnce(pagina([propostaFixture('b')], true));
    const { component } = setup({ listarPropostas });
    await component.carregar();
    expect(component.ultimaPagina()).toBe(false);
    await component.carregarMais();
    expect(component.propostas().map((p) => p.id)).toEqual(['a', 'b']);
    expect(component.ultimaPagina()).toBe(true);
    expect(listarPropostas).toHaveBeenLastCalledWith({ status: 'APROVADA', page: 1, size: 20 });
  });

  it('abrirAgenda navega para a rota da agenda por proposta', async () => {
    const { component } = setup();
    const router = TestBed.inject(Router);
    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    component.abrirAgenda(PROPOSTA_ID);
    expect(navSpy).toHaveBeenCalledWith(['/app/parcelas/proposta', PROPOSTA_ID]);
  });
});

function propostaFixture(id = PROPOSTA_ID): PropostaResponse {
  return {
    id,
    tomadorId: '1f0799c0-98b9-6d9d-bc4a-7d6f5b770001',
    solicitacaoOnboardingId: '3f0799c0-98b9-6d9d-bc4a-7d6f5b773003',
    tipoOperacao: 'CAPITAL_GIRO',
    valorSolicitado: 10000,
    moeda: 'BRL',
    prazoMeses: 12,
    status: 'APROVADA',
    dataCriacao: '2026-06-30T09:00:00-03:00',
    dataModificacao: '2026-06-30T09:00:00-03:00',
    score: null,
    parecer: null,
  };
}

function pagina(content: PropostaResponse[], last = true): PageResponse<PropostaResponse> {
  return {
    content,
    totalElements: content.length,
    totalPages: 1,
    number: 0,
    size: 20,
    first: true,
    last,
    numberOfElements: content.length,
    empty: content.length === 0,
  };
}
