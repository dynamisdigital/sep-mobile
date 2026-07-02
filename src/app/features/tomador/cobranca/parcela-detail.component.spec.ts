import { HttpErrorResponse } from '@angular/common/http';
import { EnvironmentInjector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  RecebimentoTomadorResponse,
  StatusParcela,
  ValorAtualizadoParcelaResponse,
} from '../../../core/api/api.models';
import { CobrancaMobileService } from '../../../core/cobranca/cobranca-mobile.service';
import { ParcelaDetailComponent } from './parcela-detail.component';

const CONTRATO_ID = '1f155daf-c0e8-6f15-be21-5f51a516a416';
const PARCELA_ID = '3f155daf-c0e8-6f15-be21-5f51a516a417';

// Instance-based: Ionic nao monta no happy-dom. UI renderizada validada no smoke Playwright (M-9.6).
function setup(
  params: { contratoId?: string; parcelaId?: string },
  svc: Partial<Record<keyof CobrancaMobileService, ReturnType<typeof vi.fn>>> = {},
) {
  const cobranca = {
    consultarParcela: svc.consultarParcela ?? vi.fn().mockResolvedValue(parcelaFixture()),
    consultarRecebimentos:
      svc.consultarRecebimentos ?? vi.fn().mockResolvedValue(recebimentosFixture()),
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
      { provide: CobrancaMobileService, useValue: cobranca },
      { provide: ActivatedRoute, useValue: activatedRoute },
    ],
  });
  const injector = TestBed.inject(EnvironmentInjector);
  const component = runInInjectionContext(injector, () => new ParcelaDetailComponent());
  return { component, cobranca };
}

describe('ParcelaDetailComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('consulta a parcela pelo parcelaId da rota e expoe o snapshot sem transformar', async () => {
    const parcela = parcelaFixture('ATRASADA');
    const { component, cobranca } = setup(
      { contratoId: CONTRATO_ID, parcelaId: PARCELA_ID },
      { consultarParcela: vi.fn().mockResolvedValue(parcela) },
    );
    await component.ngOnInit();
    expect(cobranca.consultarParcela).toHaveBeenCalledWith(PARCELA_ID);
    // Sem recalculo: o objeto exibido e exatamente o recebido do backend.
    expect(component.parcela()).toEqual(parcela);
    expect(component.consultadoEm()).not.toBeNull();
    expect(component.erro()).toBeNull();
  });

  it('atualizar sob demanda reconsulta a parcela (sem polling)', async () => {
    const { component, cobranca } = setup({ contratoId: CONTRATO_ID, parcelaId: PARCELA_ID });
    await component.ngOnInit();
    await component.carregar();
    expect(cobranca.consultarParcela).toHaveBeenCalledTimes(2);
  });

  it('403 mostra mensagem neutra e nao expoe a parcela', async () => {
    const { component } = setup(
      { contratoId: CONTRATO_ID, parcelaId: PARCELA_ID },
      { consultarParcela: vi.fn().mockRejectedValue(new HttpErrorResponse({ status: 403 })) },
    );
    await component.ngOnInit();
    expect(component.parcela()).toBeNull();
    expect(component.erro()).toBe('Voce nao tem acesso a esta parcela.');
  });

  it('404 informa indisponibilidade e permite voltar a agenda', async () => {
    const { component } = setup(
      { contratoId: CONTRATO_ID, parcelaId: PARCELA_ID },
      { consultarParcela: vi.fn().mockRejectedValue(new HttpErrorResponse({ status: 404 })) },
    );
    const router = TestBed.inject(Router);
    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    await component.ngOnInit();
    expect(component.parcela()).toBeNull();
    expect(component.erro()).toContain('indisponivel');
    component.voltarParaAgenda();
    expect(navSpy).toHaveBeenCalledWith(['/app/parcelas/contratos', CONTRATO_ID]);
  });

  it('erro de rede pos-carga mantem o ultimo snapshot marcado como desatualizado', async () => {
    const consultarParcela = vi
      .fn()
      .mockResolvedValueOnce(parcelaFixture('PENDENTE'))
      .mockRejectedValueOnce(new Error('rede'));
    const { component } = setup(
      { contratoId: CONTRATO_ID, parcelaId: PARCELA_ID },
      { consultarParcela },
    );
    await component.ngOnInit();
    await component.carregar();
    // Snapshot anterior permanece visivel, sinalizado como desatualizado.
    expect(component.parcela()?.status).toBe('PENDENTE');
    expect(component.desatualizado()).toBe(true);
    expect(component.erro()).toContain('anteriores');
  });

  it('erro de rede na primeira carga (sem snapshot) expoe erro cheio com retry', async () => {
    const { component } = setup(
      { contratoId: CONTRATO_ID, parcelaId: PARCELA_ID },
      { consultarParcela: vi.fn().mockRejectedValue(new Error('rede')) },
    );
    await component.ngOnInit();
    expect(component.parcela()).toBeNull();
    expect(component.erro()).toContain('Tente novamente');
  });

  it('resposta obsoleta nao sobrescreve a atual (token de geracao)', async () => {
    let resolverPrimeira: (p: ValorAtualizadoParcelaResponse) => void = () => undefined;
    const consultarParcela = vi
      .fn()
      .mockReturnValueOnce(
        new Promise<ValorAtualizadoParcelaResponse>((resolve) => {
          resolverPrimeira = resolve;
        }),
      )
      .mockResolvedValueOnce(parcelaFixture('PAGA'));
    const { component } = setup(
      { contratoId: CONTRATO_ID, parcelaId: PARCELA_ID },
      { consultarParcela },
    );
    const primeira = component.ngOnInit();
    const segunda = component.carregar();
    await segunda;
    // A primeira (obsoleta) resolve por ultimo com outro valor, mas nao deve sobrescrever.
    resolverPrimeira(parcelaFixture('PENDENTE'));
    await primeira;
    expect(component.parcela()?.status).toBe('PAGA');
  });

  it('EM_NEGOCIACAO sinaliza a negociacao (sem CTA de termos — gate B2)', async () => {
    const { component } = setup(
      { contratoId: CONTRATO_ID, parcelaId: PARCELA_ID },
      { consultarParcela: vi.fn().mockResolvedValue(parcelaFixture('EM_NEGOCIACAO')) },
    );
    await component.ngOnInit();
    expect(component.emNegociacao()).toBe(true);
    expect(component.foiRenegociada()).toBe(false);
  });

  it('RENEGOCIADA oferece retorno para a agenda ativa', async () => {
    const { component } = setup(
      { contratoId: CONTRATO_ID, parcelaId: PARCELA_ID },
      { consultarParcela: vi.fn().mockResolvedValue(parcelaFixture('RENEGOCIADA')) },
    );
    const router = TestBed.inject(Router);
    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    await component.ngOnInit();
    expect(component.foiRenegociada()).toBe(true);
    component.voltarParaAgenda();
    expect(navSpy).toHaveBeenCalledWith(['/app/parcelas/contratos', CONTRATO_ID]);
  });

  // --- Historico de recebimentos (M-9.4 — backend B1/Sprint 23) ---

  it('historico e lazy: fechado por padrao e sem consulta no init', async () => {
    const { component, cobranca } = setup({ contratoId: CONTRATO_ID, parcelaId: PARCELA_ID });
    await component.ngOnInit();
    expect(component.historicoAberto()).toBe(false);
    expect(component.recebimentos()).toBeNull();
    expect(cobranca.consultarRecebimentos).not.toHaveBeenCalled();
  });

  it('primeira abertura consulta o endpoint owner-scoped; reabrir nao reconsulta', async () => {
    const { component, cobranca } = setup({ contratoId: CONTRATO_ID, parcelaId: PARCELA_ID });
    await component.ngOnInit();
    component.alternarHistorico();
    await vi.waitFor(() => expect(component.historicoCarregando()).toBe(false));
    expect(cobranca.consultarRecebimentos).toHaveBeenCalledWith(PARCELA_ID);
    expect(cobranca.consultarRecebimentos).toHaveBeenCalledTimes(1);
    component.alternarHistorico(); // fecha
    component.alternarHistorico(); // reabre — dados ja carregados, sem nova consulta
    expect(cobranca.consultarRecebimentos).toHaveBeenCalledTimes(1);
  });

  it('preserva a ordenacao do backend sem reordenar e sem somar totais', async () => {
    const { component } = setup({ contratoId: CONTRATO_ID, parcelaId: PARCELA_ID });
    await component.ngOnInit();
    component.alternarHistorico();
    await vi.waitFor(() => expect(component.recebimentos()).not.toBeNull());
    // Ordem DESC do backend intacta; totalRecebido do detalhe segue autoritativo (0 na fixture),
    // mesmo com 300 no historico — o app nao "corrige" o total.
    expect(component.recebimentos()?.map((r) => r.dataRecebimento)).toEqual([
      '2026-06-20T10:00:00-03:00',
      '2026-06-10T10:00:00-03:00',
    ]);
    expect(component.parcela()?.totalRecebido).toBe(0);
  });

  it('expoe apenas os 4 campos publicos do contrato B1 (sem IDs internos)', async () => {
    const { component } = setup({ contratoId: CONTRATO_ID, parcelaId: PARCELA_ID });
    await component.ngOnInit();
    component.alternarHistorico();
    await vi.waitFor(() => expect(component.recebimentos()).not.toBeNull());
    const chaves = Object.keys(component.recebimentos()![0]);
    expect(chaves.sort()).toEqual([
      'dataRecebimento',
      'meioPagamento',
      'recebimentoId',
      'valorRecebido',
    ]);
    expect(chaves).not.toContain('movimentacaoEscrowId');
    expect(chaves).not.toContain('idempotencyKey');
    expect(chaves).not.toContain('registradoPor');
  });

  it('lista vazia vira estado proprio ([]), nao erro', async () => {
    const { component } = setup(
      { contratoId: CONTRATO_ID, parcelaId: PARCELA_ID },
      { consultarRecebimentos: vi.fn().mockResolvedValue([]) },
    );
    await component.ngOnInit();
    component.alternarHistorico();
    await vi.waitFor(() => expect(component.recebimentos()).not.toBeNull());
    expect(component.recebimentos()).toEqual([]);
    expect(component.historicoErro()).toBeNull();
  });

  it('falha do historico e isolada: detalhe intacto, erro proprio e retry funciona', async () => {
    const consultarRecebimentos = vi
      .fn()
      .mockRejectedValueOnce(new HttpErrorResponse({ status: 403 }))
      .mockResolvedValueOnce(recebimentosFixture());
    const { component } = setup(
      { contratoId: CONTRATO_ID, parcelaId: PARCELA_ID },
      { consultarRecebimentos },
    );
    await component.ngOnInit();
    component.alternarHistorico();
    await vi.waitFor(() => expect(component.historicoErro()).not.toBeNull());
    // Detalhe da parcela permanece visivel e sem erro principal.
    expect(component.parcela()).not.toBeNull();
    expect(component.erro()).toBeNull();
    expect(component.recebimentos()).toBeNull();
    await component.carregarHistorico();
    expect(component.historicoErro()).toBeNull();
    expect(component.recebimentos()).toHaveLength(2);
  });

  it('atualizar historico reconsulta sob demanda', async () => {
    const { component, cobranca } = setup({ contratoId: CONTRATO_ID, parcelaId: PARCELA_ID });
    await component.ngOnInit();
    component.alternarHistorico();
    await vi.waitFor(() => expect(component.recebimentos()).not.toBeNull());
    await component.carregarHistorico();
    expect(cobranca.consultarRecebimentos).toHaveBeenCalledTimes(2);
  });
});

function recebimentosFixture(): RecebimentoTomadorResponse[] {
  return [
    {
      recebimentoId: '4f155daf-c0e8-6f15-be21-5f51a516a419',
      valorRecebido: 200,
      dataRecebimento: '2026-06-20T10:00:00-03:00',
      meioPagamento: 'PIX',
    },
    {
      recebimentoId: '5f155daf-c0e8-6f15-be21-5f51a516a41a',
      valorRecebido: 100,
      dataRecebimento: '2026-06-10T10:00:00-03:00',
      meioPagamento: 'TRANSFERENCIA',
    },
  ];
}

function parcelaFixture(status: StatusParcela = 'ATRASADA'): ValorAtualizadoParcelaResponse {
  return {
    parcelaId: PARCELA_ID,
    numero: 1,
    status,
    dataVencimento: '2026-06-15',
    principalOriginal: 1000,
    jurosOriginal: 150,
    jurosMora: 10,
    multa: 20,
    valorDevidoAtualizado: 1180,
    totalRecebido: 0,
    valorEmAberto: 1180,
  };
}
