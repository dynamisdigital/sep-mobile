import { HttpErrorResponse } from '@angular/common/http';
import { EnvironmentInjector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ContratoResponse, StatusFormalizacao } from '../../../core/api/api.models';
import { ContratosMobileService } from '../../../core/contratos/contratos-mobile.service';
import { ContratoDetailComponent } from './contrato-detail.component';

const CONTRATO_ID = '1f1d4920-3f55-6f48-9b3e-aa1234567890';
const PROPOSTA_ID = '2f1d4920-3f55-6f48-9b3e-bb1234567890';

// Instance-based: Ionic nao monta no happy-dom. UI renderizada validada no smoke Playwright (M-8.5).
function setup(
  params: { propostaId?: string; contratoId?: string },
  svc: Partial<Record<keyof ContratosMobileService, ReturnType<typeof vi.fn>>> = {},
) {
  const contratos = {
    consultarPorProposta:
      svc.consultarPorProposta ?? vi.fn().mockResolvedValue(contratoFixture('AGUARDANDO_ACEITE')),
    consultarPorId:
      svc.consultarPorId ?? vi.fn().mockResolvedValue(contratoFixture('AGUARDANDO_ACEITE')),
  };
  const activatedRoute = {
    snapshot: {
      paramMap: { get: (k: string) => (params as Record<string, string | undefined>)[k] ?? null },
    },
  };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: ContratosMobileService, useValue: contratos },
      { provide: ActivatedRoute, useValue: activatedRoute },
    ],
  });
  const injector = TestBed.inject(EnvironmentInjector);
  const component = runInInjectionContext(injector, () => new ContratoDetailComponent());
  return { component, contratos };
}

describe('ContratoDetailComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('rota por proposta consulta consultarPorProposta', async () => {
    const { component, contratos } = setup({ propostaId: PROPOSTA_ID });
    await component.ngOnInit();
    expect(contratos.consultarPorProposta).toHaveBeenCalledWith(PROPOSTA_ID);
    expect(contratos.consultarPorId).not.toHaveBeenCalled();
    expect(component.contrato()?.id).toBe(CONTRATO_ID);
  });

  it('rota por contrato consulta consultarPorId', async () => {
    const { component, contratos } = setup({ contratoId: CONTRATO_ID });
    await component.ngOnInit();
    expect(contratos.consultarPorId).toHaveBeenCalledWith(CONTRATO_ID);
    expect(contratos.consultarPorProposta).not.toHaveBeenCalled();
    expect(component.contrato()?.id).toBe(CONTRATO_ID);
  });

  it('contrato sem versao vigente e um estado valido (sem crash, sem erro)', async () => {
    const { component } = setup(
      { contratoId: CONTRATO_ID },
      {
        consultarPorId: vi
          .fn()
          .mockResolvedValue(contratoFixture('GERADO', { versaoVigente: null })),
      },
    );
    await component.ngOnInit();
    expect(component.contrato()?.versaoVigente).toBeNull();
    expect(component.erro()).toBeNull();
  });

  it('404 informa contrato ainda indisponivel', async () => {
    const { component } = setup(
      { propostaId: PROPOSTA_ID },
      { consultarPorProposta: vi.fn().mockRejectedValue(new HttpErrorResponse({ status: 404 })) },
    );
    await component.ngOnInit();
    expect(component.contrato()).toBeNull();
    expect(component.erro()).toContain('indisponivel');
  });

  it('403 nao revela existencia de contrato alheio (mensagem neutra)', async () => {
    const { component } = setup(
      { contratoId: CONTRATO_ID },
      { consultarPorId: vi.fn().mockRejectedValue(new HttpErrorResponse({ status: 403 })) },
    );
    await component.ngOnInit();
    expect(component.contrato()).toBeNull();
    expect(component.erro()).toBe('Voce nao tem acesso a este contrato.');
  });

  it('erro de rede expoe mensagem de retry e retry recarrega', async () => {
    const consultarPorId = vi
      .fn()
      .mockRejectedValueOnce(new Error('rede'))
      .mockResolvedValue(contratoFixture('ACEITO'));
    const { component } = setup({ contratoId: CONTRATO_ID }, { consultarPorId });
    await component.ngOnInit();
    expect(component.erro()).toContain('Tente novamente');
    await component.carregar();
    expect(consultarPorId).toHaveBeenCalledTimes(2);
    expect(component.contrato()?.status).toBe('ACEITO');
    expect(component.erro()).toBeNull();
  });
});

function contratoFixture(
  status: StatusFormalizacao,
  over: Partial<ContratoResponse> = {},
): ContratoResponse {
  return {
    id: CONTRATO_ID,
    propostaId: PROPOSTA_ID,
    tomadorId: '3f1d4920-3f55-6f48-9b3e-cc1234567890',
    tipo: 'MUTUO',
    status,
    versaoVigente: {
      id: '9f1d4920-3f55-6f48-9b3e-000000000001',
      numero: 1,
      conteudoTexto: 'Conteudo da versao 1',
      hashSha256: 'ba7816bf8f01cfea414140de5dae2223',
      dataGeracao: '2026-06-30T09:00:00-03:00',
      parecerOrigemId: null,
      clausulas: [],
    },
    aceite: null,
    dataCriacao: '2026-06-30T09:00:00-03:00',
    dataModificacao: '2026-06-30T09:00:00-03:00',
    ...over,
  };
}
