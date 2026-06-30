import { HttpErrorResponse } from '@angular/common/http';
import { EnvironmentInjector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ParecerCreditoResponse, PropostaResponse } from '../../../core/api/api.models';
import { CreditoMobileService } from '../../../core/credito/credito-mobile.service';
import { PropostaDetailComponent } from './proposta-detail.component';

const PROPOSTA_ID = '3f0799c0-98b9-6d9d-bc4a-7d6f5b773003';

// Instance-based: Ionic (ion-content/ion-button) nao monta no happy-dom. As assercoes de
// "nenhum controle interno renderizado" ficam no smoke Playwright (M-7.6).
function setup(opts: { consultarProposta?: ReturnType<typeof vi.fn>; id?: string } = {}) {
  const id = opts.id ?? PROPOSTA_ID;
  const credito = {
    consultarProposta: opts.consultarProposta ?? vi.fn().mockResolvedValue(propostaFixture()),
  };
  const activatedRoute = {
    snapshot: { paramMap: { get: (k: string) => (k === 'id' ? id : null) } },
  };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: CreditoMobileService, useValue: credito },
      { provide: ActivatedRoute, useValue: activatedRoute },
    ],
  });
  const injector = TestBed.inject(EnvironmentInjector);
  const component = runInInjectionContext(injector, () => new PropostaDetailComponent());
  return { component, credito, id };
}

function parecerFixture(): ParecerCreditoResponse {
  return {
    id: 'p1',
    propostaId: PROPOSTA_ID,
    pareceristaId: 'op-1',
    decisao: 'APROVAR',
    justificativa: 'Renda compativel com o valor solicitado.',
    scoreMotorSnapshot: 820,
    versao: 1,
    dataParecer: '2026-06-30T10:00:00-03:00',
  };
}

function propostaFixture(over: Partial<PropostaResponse> = {}): PropostaResponse {
  return {
    id: PROPOSTA_ID,
    tomadorId: '2f0799c0-98b9-6d9d-bc4a-7d6f5b772002',
    solicitacaoOnboardingId: '1f0799c0-98b9-6d9d-bc4a-7d6f5b771001',
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

describe('PropostaDetailComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('ngOnInit le o id da rota e consulta a proposta', async () => {
    const { component, credito } = setup();
    await component.ngOnInit();
    expect(credito.consultarProposta).toHaveBeenCalledWith(PROPOSTA_ID);
    expect(component.proposta()?.id).toBe(PROPOSTA_ID);
    expect(component.carregando()).toBe(false);
  });

  it('expoe o feedback do parecer (decisao/justificativa/data) quando presente', async () => {
    const { component } = setup({
      consultarProposta: vi.fn().mockResolvedValue(propostaFixture({ parecer: parecerFixture() })),
    });
    await component.ngOnInit();
    const view = component as unknown as { rotuloDecisao(d: 'APROVAR'): string };
    expect(component.proposta()?.parecer?.justificativa).toContain('Renda compativel');
    expect(view.rotuloDecisao('APROVAR')).toBe('Aprovado');
  });

  it('parecer ausente e um estado normal (sem erro)', async () => {
    const { component } = setup({
      consultarProposta: vi.fn().mockResolvedValue(propostaFixture({ parecer: null })),
    });
    await component.ngOnInit();
    expect(component.proposta()?.parecer).toBeNull();
    expect(component.erro()).toBeNull();
  });

  it('404 mostra mensagem de proposta nao encontrada', async () => {
    const { component } = setup({
      consultarProposta: vi.fn().mockRejectedValue(new HttpErrorResponse({ status: 404 })),
    });
    await component.ngOnInit();
    expect(component.proposta()).toBeNull();
    expect(component.erro()).toBe('Proposta nao encontrada.');
  });

  it('403 (proposta de outro tomador) expoe a mensagem do backend', async () => {
    const { component } = setup({
      consultarProposta: vi
        .fn()
        .mockRejectedValue(
          new HttpErrorResponse({ status: 403, error: { message: 'Proposta de outro tomador' } }),
        ),
    });
    await component.ngOnInit();
    expect(component.proposta()).toBeNull();
    expect(component.erro()).toBe('Proposta de outro tomador');
  });

  it('erro generico expoe mensagem de retry', async () => {
    const { component } = setup({
      consultarProposta: vi
        .fn()
        .mockRejectedValueOnce(new Error('rede'))
        .mockResolvedValue(propostaFixture()),
    });
    await component.ngOnInit();
    expect(component.erro()).toContain('Tente novamente');
  });

  it('retry recarrega a proposta', async () => {
    const consultarProposta = vi
      .fn()
      .mockRejectedValueOnce(new Error('rede'))
      .mockResolvedValue(propostaFixture());
    const { component } = setup({ consultarProposta });
    await component.ngOnInit();
    expect(component.erro()).not.toBeNull();
    await component.carregar();
    expect(consultarProposta).toHaveBeenCalledTimes(2);
    expect(component.proposta()?.id).toBe(PROPOSTA_ID);
    expect(component.erro()).toBeNull();
  });

  it('CTA Open Finance navega para a proposta correta', async () => {
    const { component } = setup();
    const router = TestBed.inject(Router);
    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    await component.ngOnInit();
    component.abrirOpenFinance();
    expect(navSpy).toHaveBeenCalledWith(['/app/propostas', PROPOSTA_ID, 'open-finance']);
  });
});
