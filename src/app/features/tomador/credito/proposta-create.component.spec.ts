import { HttpErrorResponse } from '@angular/common/http';
import { EnvironmentInjector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PropostaResponse } from '../../../core/api/api.models';
import { CreditoMobileService } from '../../../core/credito/credito-mobile.service';
import { OnboardingJourneyStore } from '../../../core/onboarding/onboarding-journey.store';
import { PropostaCreateComponent } from './proposta-create.component';

const ONBOARDING_ID = '1f0799c0-98b9-6d9d-bc4a-7d6f5b771001';
const PROPOSTA_ID = '3f0799c0-98b9-6d9d-bc4a-7d6f5b773003';

// Ionic (ion-select/ion-input) nao monta no happy-dom; testamos a logica por instancia
// (convencao do repo). O render real e coberto pelo smoke Playwright na Task M-7.6.
function setup(opts: { journeyId?: string | null; criarProposta?: ReturnType<typeof vi.fn> } = {}) {
  const credito = {
    criarProposta: opts.criarProposta ?? vi.fn().mockResolvedValue(propostaFixture()),
  };
  const journey = {
    carregar: vi
      .fn()
      .mockResolvedValue(
        opts.journeyId === undefined ? { tipo: 'PF', onboardingId: ONBOARDING_ID } : null,
      ),
  };
  if (opts.journeyId) {
    journey.carregar.mockResolvedValue({ tipo: 'PF', onboardingId: opts.journeyId });
  }
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: CreditoMobileService, useValue: credito },
      { provide: OnboardingJourneyStore, useValue: journey },
    ],
  });
  const injector = TestBed.inject(EnvironmentInjector);
  const component = runInInjectionContext(injector, () => new PropostaCreateComponent());
  return { component, credito, journey };
}

function propostaFixture(): PropostaResponse {
  return {
    id: PROPOSTA_ID,
    tomadorId: '2f0799c0-98b9-6d9d-bc4a-7d6f5b772002',
    solicitacaoOnboardingId: ONBOARDING_ID,
    tipoOperacao: 'CAPITAL_GIRO',
    valorSolicitado: 10000,
    moeda: 'BRL',
    prazoMeses: 12,
    status: 'EM_ANALISE',
    dataCriacao: '2026-06-30T09:00:00-03:00',
    dataModificacao: '2026-06-30T09:00:00-03:00',
    score: null,
    parecer: null,
  };
}

function preencherValido(component: PropostaCreateComponent): void {
  component.form.setValue({ tipoOperacao: 'CAPITAL_GIRO', valorSolicitado: 10000, prazoMeses: 12 });
}

describe('PropostaCreateComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('sem ponteiro de onboarding nao submete e oferece o onboarding', async () => {
    const { component, credito } = setup({ journeyId: null });
    await component.ngOnInit();
    expect(component.onboardingId()).toBeNull();
    expect(component.carregandoJornada()).toBe(false);
    preencherValido(component);
    await component.submit();
    expect(credito.criarProposta).not.toHaveBeenCalled();
  });

  it('usa o ponteiro da M-6 como solicitacaoOnboardingId sem expor UUID no formulario', async () => {
    const { component, credito } = setup({ journeyId: ONBOARDING_ID });
    await component.ngOnInit();
    expect(component.form.contains('solicitacaoOnboardingId')).toBe(false);
    preencherValido(component);
    await component.submit();
    expect(credito.criarProposta).toHaveBeenCalledWith({
      solicitacaoOnboardingId: ONBOARDING_ID,
      tipoOperacao: 'CAPITAL_GIRO',
      valorSolicitado: 10000,
      prazoMeses: 12,
    });
  });

  it('validacoes basicas impedem payload invalido', async () => {
    const { component, credito } = setup({ journeyId: ONBOARDING_ID });
    await component.ngOnInit();
    await component.submit();
    expect(credito.criarProposta).not.toHaveBeenCalled();
    component.form.patchValue({ valorSolicitado: 0, prazoMeses: 12 });
    expect(component.form.controls.valorSolicitado.valid).toBe(false);
    component.form.patchValue({ valorSolicitado: 10000, prazoMeses: 1.5 });
    expect(component.form.controls.prazoMeses.hasError('inteiro')).toBe(true);
  });

  it('sucesso 201 navega para o detalhe da proposta', async () => {
    const { component } = setup({ journeyId: ONBOARDING_ID });
    const router = TestBed.inject(Router);
    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    await component.ngOnInit();
    preencherValido(component);
    await component.submit();
    expect(navSpy).toHaveBeenCalledWith(['/app/propostas', PROPOSTA_ID]);
  });

  it('422 marca pre-condicao de onboarding e oferece revisao', async () => {
    const criarProposta = vi
      .fn()
      .mockRejectedValue(
        new HttpErrorResponse({ status: 422, error: { message: 'Nao aprovado' } }),
      );
    const { component } = setup({ journeyId: ONBOARDING_ID, criarProposta });
    await component.ngOnInit();
    preencherValido(component);
    await component.submit();
    expect(component.revisarOnboarding()).toBe(true);
    expect(component.erro()).toBe('Nao aprovado');
  });

  it('404 expoe mensagem sem marcar revisao de onboarding', async () => {
    const criarProposta = vi
      .fn()
      .mockRejectedValue(new HttpErrorResponse({ status: 404, error: {} }));
    const { component } = setup({ journeyId: ONBOARDING_ID, criarProposta });
    await component.ngOnInit();
    preencherValido(component);
    await component.submit();
    expect(component.revisarOnboarding()).toBe(false);
    expect(component.erro()).toContain('Onboarding nao encontrado');
  });

  it('clique duplo nao dispara duas chamadas enquanto carrega', async () => {
    let resolver: (p: PropostaResponse) => void = () => undefined;
    const criarProposta = vi
      .fn()
      .mockReturnValue(new Promise<PropostaResponse>((r) => (resolver = r)));
    const { component } = setup({ journeyId: ONBOARDING_ID, criarProposta });
    await component.ngOnInit();
    preencherValido(component);
    const primeira = component.submit();
    await component.submit();
    expect(criarProposta).toHaveBeenCalledTimes(1);
    resolver(propostaFixture());
    await primeira;
  });
});
