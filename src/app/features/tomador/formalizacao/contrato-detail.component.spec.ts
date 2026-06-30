import { HttpErrorResponse } from '@angular/common/http';
import { EnvironmentInjector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ContratoResponse,
  StatusFormalizacao,
  VersaoContratoResponse,
} from '../../../core/api/api.models';
import { ContratosMobileService } from '../../../core/contratos/contratos-mobile.service';
import { ContratoDetailComponent } from './contrato-detail.component';

const CONTRATO_ID = '1f1d4920-3f55-6f48-9b3e-aa1234567890';
const PROPOSTA_ID = '2f1d4920-3f55-6f48-9b3e-bb1234567890';
const VERSAO_1_ID = '9f1d4920-3f55-6f48-9b3e-000000000001';
const VERSAO_2_ID = '9f1d4920-3f55-6f48-9b3e-000000000002';

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
    listarVersoes:
      svc.listarVersoes ?? vi.fn().mockResolvedValue([versaoFixture(1), versaoFixture(2)]),
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

  it('por padrao exibe a versao vigente embutida no contrato', async () => {
    const { component } = setup({ contratoId: CONTRATO_ID });
    await component.ngOnInit();
    expect(component.versaoExibida()?.id).toBe(VERSAO_2_ID);
    expect(component.exibindoVigente()).toBe(true);
  });

  it('conteudo e clausulas chegam sem transformacao (texto literal, sem parse de HTML)', async () => {
    const conteudoComTag = 'Clausula <script>alert(1)</script> & <b>texto</b>';
    const { component } = setup(
      { contratoId: CONTRATO_ID },
      {
        consultarPorId: vi.fn().mockResolvedValue(
          contratoFixture('AGUARDANDO_ACEITE', {
            versaoVigente: versaoFixture(2, { conteudoTexto: conteudoComTag }),
          }),
        ),
      },
    );
    await component.ngOnInit();
    // O valor cru e preservado; a renderizacao por interpolacao do template escapa as tags.
    expect(component.versaoExibida()?.conteudoTexto).toBe(conteudoComTag);
    expect(component.versaoExibida()?.clausulas.map((c) => c.ordem)).toEqual([1, 2]);
  });

  it('abre o historico carregando as versoes uma unica vez, em ordem ascendente', async () => {
    const listarVersoes = vi.fn().mockResolvedValue([versaoFixture(1), versaoFixture(2)]);
    const { component } = setup({ contratoId: CONTRATO_ID }, { listarVersoes });
    await component.ngOnInit();
    await component.abrirHistorico();
    await component.abrirHistorico();
    expect(listarVersoes).toHaveBeenCalledTimes(1);
    expect(component.versoes().map((v) => v.numero)).toEqual([1, 2]);
    expect(component.historicoAberto()).toBe(true);
  });

  it('selecionar versao historica nao altera a vigente e desabilita a marca de vigente', async () => {
    const { component } = setup({ contratoId: CONTRATO_ID });
    await component.ngOnInit();
    await component.abrirHistorico();
    component.selecionarVersao(VERSAO_1_ID);
    expect(component.versaoExibida()?.id).toBe(VERSAO_1_ID);
    expect(component.exibindoVigente()).toBe(false);
    // A vigente do contrato permanece intacta.
    expect(component.contrato()?.versaoVigente?.id).toBe(VERSAO_2_ID);
    component.voltarParaVigente();
    expect(component.versaoExibida()?.id).toBe(VERSAO_2_ID);
    expect(component.exibindoVigente()).toBe(true);
  });

  it('falha ao carregar o historico nao impede a leitura da versao vigente', async () => {
    const listarVersoes = vi.fn().mockRejectedValue(new Error('rede'));
    const { component } = setup({ contratoId: CONTRATO_ID }, { listarVersoes });
    await component.ngOnInit();
    await component.abrirHistorico();
    expect(component.erroVersoes()).not.toBeNull();
    expect(component.versaoExibida()?.id).toBe(VERSAO_2_ID);
    expect(component.exibindoVigente()).toBe(true);
  });

  it('contrato sem versao vigente nao tem versao exibida', async () => {
    const { component } = setup(
      { contratoId: CONTRATO_ID },
      {
        consultarPorId: vi
          .fn()
          .mockResolvedValue(contratoFixture('GERADO', { versaoVigente: null })),
      },
    );
    await component.ngOnInit();
    expect(component.versaoExibida()).toBeNull();
    expect(component.erro()).toBeNull();
  });

  it('copiarHash usa a clipboard e marca o estado copiado', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const { component } = setup({ contratoId: CONTRATO_ID });
    await component.ngOnInit();
    await component.copiarHash('hash-da-versao-2');
    expect(writeText).toHaveBeenCalledWith('hash-da-versao-2');
    expect(component.hashCopiado()).toBe(true);
  });

  it('copiarHash trata falha da clipboard sem lancar nem marcar copiado', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('clipboard negada'));
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const { component } = setup({ contratoId: CONTRATO_ID });
    await component.ngOnInit();
    await expect(component.copiarHash('hash-da-versao-2')).resolves.toBeUndefined();
    expect(component.hashCopiado()).toBe(false);
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
    versaoVigente: versaoFixture(2),
    aceite: null,
    dataCriacao: '2026-06-30T09:00:00-03:00',
    dataModificacao: '2026-06-30T09:00:00-03:00',
    ...over,
  };
}

function versaoFixture(
  numero: number,
  over: Partial<VersaoContratoResponse> = {},
): VersaoContratoResponse {
  return {
    id: numero === 1 ? VERSAO_1_ID : VERSAO_2_ID,
    numero,
    conteudoTexto: `Conteudo da versao ${numero}`,
    hashSha256: `hash-da-versao-${numero}`,
    dataGeracao: '2026-06-30T09:00:00-03:00',
    parecerOrigemId: null,
    clausulas: [
      { id: `c-${numero}-1`, ordem: 1, titulo: 'OBJETO', texto: 'Texto da clausula 1.' },
      { id: `c-${numero}-2`, ordem: 2, titulo: 'PRAZO', texto: 'Texto da clausula 2.' },
    ],
    ...over,
  };
}
