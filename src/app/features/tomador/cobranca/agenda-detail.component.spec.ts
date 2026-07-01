import { HttpErrorResponse } from '@angular/common/http';
import { EnvironmentInjector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AgendaPagamentoResponse,
  ContratoResponse,
  ParcelaResponse,
  StatusFormalizacao,
  StatusParcela,
} from '../../../core/api/api.models';
import { CobrancaMobileService } from '../../../core/cobranca/cobranca-mobile.service';
import { ContratosMobileService } from '../../../core/contratos/contratos-mobile.service';
import { AgendaDetailComponent } from './agenda-detail.component';

const CONTRATO_ID = '1f155daf-c0e8-6f15-be21-5f51a516a416';
const PROPOSTA_ID = '2f1d4920-3f55-6f48-9b3e-bb1234567890';
const PARCELA_ID = '3f155daf-c0e8-6f15-be21-5f51a516a417';

const TODOS_STATUS: StatusParcela[] = [
  'PENDENTE',
  'PARCIALMENTE_PAGA',
  'PAGA',
  'ATRASADA',
  'INADIMPLENTE',
  'EM_NEGOCIACAO',
  'RENEGOCIADA',
];

// Instance-based: Ionic nao monta no happy-dom. UI renderizada validada no smoke Playwright (M-9.6).
function setup(
  params: { propostaId?: string; contratoId?: string },
  contratosSvc: Partial<Record<keyof ContratosMobileService, ReturnType<typeof vi.fn>>> = {},
  cobrancaSvc: Partial<Record<keyof CobrancaMobileService, ReturnType<typeof vi.fn>>> = {},
) {
  const contratos = {
    consultarPorProposta:
      contratosSvc.consultarPorProposta ?? vi.fn().mockResolvedValue(contratoFixture('ASSINADO')),
    consultarPorId:
      contratosSvc.consultarPorId ?? vi.fn().mockResolvedValue(contratoFixture('ASSINADO')),
  };
  const cobranca = {
    consultarAgenda: cobrancaSvc.consultarAgenda ?? vi.fn().mockResolvedValue(agendaFixture()),
  };
  const activatedRoute = {
    snapshot: {
      paramMap: { get: (k: string) => (params as Record<string, string | undefined>)[k] ?? null },
    },
  };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: ContratosMobileService, useValue: contratos },
      { provide: CobrancaMobileService, useValue: cobranca },
      { provide: ActivatedRoute, useValue: activatedRoute },
    ],
  });
  const injector = TestBed.inject(EnvironmentInjector);
  const component = runInInjectionContext(injector, () => new AgendaDetailComponent());
  return { component, contratos, cobranca };
}

describe('AgendaDetailComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('rota por proposta resolve contrato via consultarPorProposta e depois a agenda', async () => {
    const { component, contratos, cobranca } = setup({ propostaId: PROPOSTA_ID });
    await component.ngOnInit();
    expect(contratos.consultarPorProposta).toHaveBeenCalledWith(PROPOSTA_ID);
    expect(contratos.consultarPorId).not.toHaveBeenCalled();
    expect(cobranca.consultarAgenda).toHaveBeenCalledWith(CONTRATO_ID);
    expect(component.agenda()?.contratoId).toBe(CONTRATO_ID);
  });

  it('rota por contrato resolve contrato via consultarPorId e depois a agenda', async () => {
    const { component, contratos, cobranca } = setup({ contratoId: CONTRATO_ID });
    await component.ngOnInit();
    expect(contratos.consultarPorId).toHaveBeenCalledWith(CONTRATO_ID);
    expect(contratos.consultarPorProposta).not.toHaveBeenCalled();
    expect(cobranca.consultarAgenda).toHaveBeenCalledWith(CONTRATO_ID);
  });

  it('contrato nao ASSINADO nao dispara chamada de agenda e informa indisponibilidade', async () => {
    const { component, cobranca } = setup(
      { contratoId: CONTRATO_ID },
      { consultarPorId: vi.fn().mockResolvedValue(contratoFixture('AGUARDANDO_ACEITE')) },
    );
    await component.ngOnInit();
    expect(cobranca.consultarAgenda).not.toHaveBeenCalled();
    expect(component.agenda()).toBeNull();
    expect(component.indisponivel()).toContain('assinatura');
    expect(component.erro()).toBeNull();
  });

  it('agenda 404 vira "parcelas ainda indisponiveis" (nunca lista vazia) e retry recarrega', async () => {
    const consultarAgenda = vi
      .fn()
      .mockRejectedValueOnce(new HttpErrorResponse({ status: 404 }))
      .mockResolvedValue(agendaFixture());
    const { component } = setup({ contratoId: CONTRATO_ID }, {}, { consultarAgenda });
    await component.ngOnInit();
    expect(component.agenda()).toBeNull();
    expect(component.indisponivel()).toContain('indisponiveis');
    await component.carregar();
    expect(consultarAgenda).toHaveBeenCalledTimes(2);
    expect(component.agenda()?.contratoId).toBe(CONTRATO_ID);
    expect(component.indisponivel()).toBeNull();
  });

  it('403 de ownership mostra mensagem neutra e nao carrega agenda', async () => {
    const { component } = setup(
      { contratoId: CONTRATO_ID },
      {},
      { consultarAgenda: vi.fn().mockRejectedValue(new HttpErrorResponse({ status: 403 })) },
    );
    await component.ngOnInit();
    expect(component.agenda()).toBeNull();
    expect(component.indisponivel()).toBeNull();
    expect(component.erro()).toBe('Voce nao tem acesso a estas parcelas.');
  });

  it('erro de rede expoe retry e retry recarrega', async () => {
    const consultarPorId = vi
      .fn()
      .mockRejectedValueOnce(new Error('rede'))
      .mockResolvedValue(contratoFixture('ASSINADO'));
    const { component, cobranca } = setup({ contratoId: CONTRATO_ID }, { consultarPorId });
    await component.ngOnInit();
    expect(component.erro()).toContain('Tente novamente');
    await component.carregar();
    expect(consultarPorId).toHaveBeenCalledTimes(2);
    expect(cobranca.consultarAgenda).toHaveBeenCalledTimes(1);
    expect(component.agenda()).not.toBeNull();
    expect(component.erro()).toBeNull();
  });

  it('agenda vazia e um estado valido (sem erro)', async () => {
    const { component } = setup(
      { contratoId: CONTRATO_ID },
      {},
      { consultarAgenda: vi.fn().mockResolvedValue(agendaFixture([])) },
    );
    await component.ngOnInit();
    expect(component.agenda()?.parcelas).toEqual([]);
    expect(component.erro()).toBeNull();
    expect(component.indisponivel()).toBeNull();
  });

  it('lista todos os status recebidos sem inferir prioridade, com rotulo para cada um', async () => {
    const parcelas = TODOS_STATUS.map((status, i) => parcelaFixture(status, i + 1));
    const { component } = setup(
      { contratoId: CONTRATO_ID },
      {},
      { consultarAgenda: vi.fn().mockResolvedValue(agendaFixture(parcelas)) },
    );
    await component.ngOnInit();
    // Ordem recebida do backend e preservada.
    expect(component.agenda()?.parcelas.map((p) => p.status)).toEqual(TODOS_STATUS);
    for (const status of TODOS_STATUS) {
      expect(component.rotuloStatus(status)).toBeTruthy();
    }
  });

  it('abrirParcela navega ao detalhe preservando contratoId e parcelaId', async () => {
    const { component } = setup({ propostaId: PROPOSTA_ID });
    const router = TestBed.inject(Router);
    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    await component.ngOnInit();
    component.abrirParcela(PARCELA_ID);
    expect(navSpy).toHaveBeenCalledWith([
      '/app/parcelas/contratos',
      CONTRATO_ID,
      'parcelas',
      PARCELA_ID,
    ]);
  });
});

function contratoFixture(status: StatusFormalizacao): ContratoResponse {
  return {
    id: CONTRATO_ID,
    propostaId: PROPOSTA_ID,
    tomadorId: '4f1d4920-3f55-6f48-9b3e-cc1234567890',
    tipo: 'MUTUO',
    status,
    versaoVigente: null,
    aceite: null,
    dataCriacao: '2026-06-30T09:00:00-03:00',
    dataModificacao: '2026-06-30T09:00:00-03:00',
  };
}

function parcelaFixture(status: StatusParcela, numero: number): ParcelaResponse {
  return {
    id: numero === 1 ? PARCELA_ID : `parcela-${numero}`,
    numero,
    principal: 850,
    juros: 150,
    multa: 0,
    encargos: 0,
    total: 1000,
    dataVencimento: '2026-06-15',
    status,
  };
}

function agendaFixture(
  parcelas: ParcelaResponse[] = [parcelaFixture('PENDENTE', 1), parcelaFixture('ATRASADA', 2)],
): AgendaPagamentoResponse {
  return {
    id: '0f8d2b1a-aaaa-6f15-be21-5f51a516a416',
    contratoId: CONTRATO_ID,
    numeroParcelas: parcelas.length,
    valorTotal: 2000,
    dataGeracao: '2026-05-22T10:00:00-03:00',
    parcelas,
  };
}
