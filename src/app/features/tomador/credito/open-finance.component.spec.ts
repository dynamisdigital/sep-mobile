import { HttpErrorResponse } from '@angular/common/http';
import { EnvironmentInjector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  IniciarConsentimentoOpenFinanceResponse,
  OpenFinanceStatusResponse,
} from '../../../core/api/api.models';
import { CreditoMobileService } from '../../../core/credito/credito-mobile.service';
import { OpenFinanceComponent } from './open-finance.component';

const PROPOSTA_ID = '3f0799c0-98b9-6d9d-bc4a-7d6f5b773003';

// Instance-based: Ionic (ion-input/ion-button) nao monta no happy-dom. O render e o handoff
// real (window.location) sao cobertos pelo smoke Playwright na Task M-7.6.
function setup(
  opts: {
    id?: string;
    retorno?: boolean;
    consultar?: ReturnType<typeof vi.fn>;
    iniciar?: ReturnType<typeof vi.fn>;
  } = {},
) {
  const id = opts.id ?? PROPOSTA_ID;
  const credito = {
    consultarOpenFinance: opts.consultar ?? vi.fn().mockResolvedValue(statusFixture()),
    iniciarConsentimentoOpenFinance: opts.iniciar ?? vi.fn().mockResolvedValue(consentFixture()),
  };
  const activatedRoute = {
    snapshot: {
      paramMap: { get: (k: string) => (k === 'id' ? id : null) },
      data: { retorno: opts.retorno ?? false },
    },
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
  const component = runInInjectionContext(injector, () => new OpenFinanceComponent());
  const navegar = vi
    .spyOn(component as unknown as { navegarExterno: (u: string) => void }, 'navegarExterno')
    .mockImplementation(() => undefined);
  return { component, credito, navegar, id };
}

function statusFixture(over: Partial<OpenFinanceStatusResponse> = {}): OpenFinanceStatusResponse {
  return {
    statusConsentimento: 'PENDENTE',
    dataInicio: '2026-06-30T09:00:00-03:00',
    dataAutorizacao: null,
    dataExpiracao: null,
    ultimaMovimentacao: null,
    ...over,
  };
}

function consentFixture(
  over: Partial<IniciarConsentimentoOpenFinanceResponse> = {},
): IniciarConsentimentoOpenFinanceResponse {
  return {
    consentimentoId: 'c1',
    status: 'PENDENTE',
    urlAutorizacao: 'https://banco.example/auth',
    dataExpiracao: '2026-07-01T00:00:00-03:00',
    ...over,
  };
}

describe('OpenFinanceComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('modo consentimento: 404 no GET oferece o formulario', async () => {
    const { component } = setup({
      consultar: vi.fn().mockRejectedValue(new HttpErrorResponse({ status: 404 })),
    });
    await component.ngOnInit();
    expect(component.retorno()).toBe(false);
    expect(component.semConsentimento()).toBe(true);
    expect(component.erro()).toBeNull();
  });

  it('modo retorno: consulta a API SEP usando apenas o id (ignora query params)', async () => {
    const { component, credito } = setup({
      retorno: true,
      consultar: vi.fn().mockResolvedValue(statusFixture({ statusConsentimento: 'AUTORIZADO' })),
    });
    await component.ngOnInit();
    expect(credito.consultarOpenFinance).toHaveBeenCalledWith(PROPOSTA_ID);
    expect(component.retorno()).toBe(true);
    expect(component.semConsentimento()).toBe(false);
    expect(component.status()?.statusConsentimento).toBe('AUTORIZADO');
  });

  it('documento invalido nao chama a API', async () => {
    const { component, credito } = setup();
    component.form.setValue({ documento: '123' });
    await component.iniciar();
    expect(credito.iniciarConsentimentoOpenFinance).not.toHaveBeenCalled();
  });

  it('consentimento valido: redirectUri controlada pelo app + handoff http(s)', async () => {
    const { component, credito, navegar } = setup({
      consultar: vi.fn().mockRejectedValue(new HttpErrorResponse({ status: 404 })),
    });
    await component.ngOnInit();
    component.form.setValue({ documento: '12345678901' });
    await component.iniciar();
    const [propostaId, body] = credito.iniciarConsentimentoOpenFinance.mock.calls[0];
    expect(propostaId).toBe(PROPOSTA_ID);
    expect(body.cpfCnpjTomador).toBe('12345678901');
    expect(body.redirectUri).toMatch(/^https?:\/\//);
    expect(body.redirectUri).toContain(`/app/propostas/${PROPOSTA_ID}/open-finance/retorno`);
    expect(navegar).toHaveBeenCalledWith('https://banco.example/auth');
    expect(component.form.controls.documento.value).toBe('');
  });

  it('urlAutorizacao com scheme invalido bloqueia o handoff', async () => {
    const { component, navegar } = setup({
      consultar: vi.fn().mockRejectedValue(new HttpErrorResponse({ status: 404 })),
      iniciar: vi.fn().mockResolvedValue(consentFixture({ urlAutorizacao: 'javascript:alert(1)' })),
    });
    await component.ngOnInit();
    component.form.setValue({ documento: '12345678901' });
    await component.iniciar();
    expect(navegar).not.toHaveBeenCalled();
    expect(component.erro()).toContain('bloqueado');
  });

  it('409 (consentimento ja pendente) consulta o status em vez de criar outro', async () => {
    const consultar = vi.fn().mockResolvedValue(statusFixture({ statusConsentimento: 'PENDENTE' }));
    const iniciar = vi.fn().mockRejectedValue(new HttpErrorResponse({ status: 409 }));
    const { component, navegar } = setup({ consultar, iniciar });
    await component.ngOnInit();
    consultar.mockClear();
    component.form.setValue({ documento: '12345678901' });
    await component.iniciar();
    expect(navegar).not.toHaveBeenCalled();
    expect(consultar).toHaveBeenCalledWith(PROPOSTA_ID);
    expect(component.status()?.statusConsentimento).toBe('PENDENTE');
  });

  it('exibe agregados sanitizados quando AUTORIZADO com snapshot', async () => {
    const { component } = setup({
      consultar: vi.fn().mockResolvedValue(
        statusFixture({
          statusConsentimento: 'AUTORIZADO',
          dataAutorizacao: '2026-06-30T09:05:00-03:00',
          ultimaMovimentacao: {
            mediaEntradasMensal: 5000,
            mediaSaidasMensal: 3000,
            saldoMedio: 2000,
            numeroMesesAvaliados: 6,
            dataRecebimento: '2026-06-30T09:05:00-03:00',
          },
        }),
      ),
    });
    await component.ngOnInit();
    const view = component as unknown as { agregados(): { saldoMedio: number } | null };
    expect(view.agregados()?.saldoMedio).toBe(2000);
  });

  it('AUTORIZADO sem snapshot e um estado valido (sem agregados)', async () => {
    const { component } = setup({
      consultar: vi
        .fn()
        .mockResolvedValue(
          statusFixture({ statusConsentimento: 'AUTORIZADO', ultimaMovimentacao: null }),
        ),
    });
    await component.ngOnInit();
    const view = component as unknown as { agregados(): unknown };
    expect(view.agregados()).toBeNull();
    expect(component.erro()).toBeNull();
  });

  it('mapeia os rotulos de cada status de consentimento', () => {
    const { component } = setup();
    const view = component as unknown as { rotuloStatus(s: string): string };
    expect(view.rotuloStatus('PENDENTE')).toBe('Pendente');
    expect(view.rotuloStatus('AUTORIZADO')).toBe('Autorizado');
    expect(view.rotuloStatus('NEGADO')).toBe('Negado');
    expect(view.rotuloStatus('EXPIRADO')).toBe('Expirado');
  });
});
