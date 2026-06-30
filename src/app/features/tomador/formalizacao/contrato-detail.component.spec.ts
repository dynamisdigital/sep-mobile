import { HttpErrorResponse } from '@angular/common/http';
import { EnvironmentInjector, runInInjectionContext, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ContratoResponse,
  StatusFormalizacao,
  UsuarioResponse,
  VersaoContratoResponse,
} from '../../../core/api/api.models';
import { AuthService } from '../../../core/auth/auth.service';
import { StepUpTokenStore } from '../../../core/auth/step-up-token.store';
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
  opts: { user?: UsuarioResponse | null; hasToken?: boolean } = {},
) {
  const contratos = {
    consultarPorProposta:
      svc.consultarPorProposta ?? vi.fn().mockResolvedValue(contratoFixture('AGUARDANDO_ACEITE')),
    consultarPorId:
      svc.consultarPorId ?? vi.fn().mockResolvedValue(contratoFixture('AGUARDANDO_ACEITE')),
    listarVersoes:
      svc.listarVersoes ?? vi.fn().mockResolvedValue([versaoFixture(1), versaoFixture(2)]),
    registrarAceite: svc.registrarAceite ?? vi.fn().mockResolvedValue(contratoFixture('ACEITO')),
    consultarStatusAssinatura:
      svc.consultarStatusAssinatura ?? vi.fn().mockResolvedValue(statusAssinaturaFixture()),
    baixarDocumentoAssinado:
      svc.baixarDocumentoAssinado ?? vi.fn().mockResolvedValue(documentoFixture()),
  };
  const activatedRoute = {
    snapshot: {
      paramMap: { get: (k: string) => (params as Record<string, string | undefined>)[k] ?? null },
    },
  };
  const user = opts.user === undefined ? usuarioFixture() : opts.user;
  const clear = vi.fn();
  const stepUpStore = { hasToken: () => !!opts.hasToken, clear, set: vi.fn(), consume: vi.fn() };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: ContratosMobileService, useValue: contratos },
      { provide: ActivatedRoute, useValue: activatedRoute },
      { provide: AuthService, useValue: { currentUser: signal(user) } },
      { provide: StepUpTokenStore, useValue: stepUpStore },
    ],
  });
  const injector = TestBed.inject(EnvironmentInjector);
  const component = runInInjectionContext(injector, () => new ContratoDetailComponent());
  return { component, contratos, stepUpStore, clear };
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

  // ---- M-8.4: aceite com step-up ----

  it('podeAceitar so para versao vigente em AGUARDANDO_ACEITE e usuario CLIENTE', async () => {
    const { component } = setup({ contratoId: CONTRATO_ID });
    await component.ngOnInit();
    expect(component.podeAceitar()).toBe(true);
    await component.abrirHistorico();
    component.selecionarVersao(VERSAO_1_ID);
    // Versao historica nunca habilita aceite.
    expect(component.podeAceitar()).toBe(false);
  });

  it('podeAceitar e falso fora de AGUARDANDO_ACEITE', async () => {
    const { component } = setup(
      { contratoId: CONTRATO_ID },
      { consultarPorId: vi.fn().mockResolvedValue(contratoFixture('ACEITO')) },
    );
    await component.ngOnInit();
    expect(component.podeAceitar()).toBe(false);
  });

  it('ngOnInit nunca dispara aceite automaticamente', async () => {
    const { component, contratos } = setup({ contratoId: CONTRATO_ID });
    await component.ngOnInit();
    expect(contratos.registrarAceite).not.toHaveBeenCalled();
  });

  it('cancelar a confirmacao nao chama a API', async () => {
    const { component, contratos } = setup({ contratoId: CONTRATO_ID });
    await component.ngOnInit();
    component.abrirConfirmacao();
    expect(component.confirmacaoAberta()).toBe(true);
    component.cancelarConfirmacao();
    expect(component.confirmacaoAberta()).toBe(false);
    expect(contratos.registrarAceite).not.toHaveBeenCalled();
  });

  it('sem MFA, bloqueia o aceite com orientacao e nao chama a API', async () => {
    const { component, contratos } = setup(
      { contratoId: CONTRATO_ID },
      {},
      {
        user: usuarioFixture({ mfaHabilitado: false }),
      },
    );
    await component.ngOnInit();
    component.abrirConfirmacao();
    await component.confirmarAceite();
    expect(contratos.registrarAceite).not.toHaveBeenCalled();
    expect(component.erroAceite()).toContain('MFA');
  });

  it('com MFA e sem token, navega ao step-up com next relativo e nao chama a API', async () => {
    const { component, contratos } = setup({ contratoId: CONTRATO_ID }, {}, { hasToken: false });
    const router = TestBed.inject(Router);
    const navSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    await component.ngOnInit();
    component.abrirConfirmacao();
    await component.confirmarAceite();
    expect(contratos.registrarAceite).not.toHaveBeenCalled();
    expect(navSpy).toHaveBeenCalledWith(
      `/app/step-up?next=/app/formalizacao/contratos/${CONTRATO_ID}`,
    );
  });

  it('com token, confirma chama PATCH uma vez, usa a resposta e consulta status', async () => {
    const registrarAceite = vi.fn().mockResolvedValue(contratoFixture('ACEITO'));
    const consultarStatusAssinatura = vi.fn().mockResolvedValue(statusAssinaturaFixture());
    const { component } = setup(
      { contratoId: CONTRATO_ID },
      { registrarAceite, consultarStatusAssinatura },
      { hasToken: true },
    );
    await component.ngOnInit();
    component.abrirConfirmacao();
    await component.confirmarAceite();
    expect(registrarAceite).toHaveBeenCalledTimes(1);
    expect(registrarAceite).toHaveBeenCalledWith(CONTRATO_ID);
    expect(component.contrato()?.status).toBe('ACEITO');
    expect(consultarStatusAssinatura).toHaveBeenCalledWith(CONTRATO_ID);
    expect(component.statusAssinatura()).not.toBeNull();
    expect(component.confirmacaoAberta()).toBe(false);
  });

  it('duplo toque nao dispara dois PATCH', async () => {
    let resolver: (c: ContratoResponse) => void = () => undefined;
    const registrarAceite = vi.fn().mockReturnValue(
      new Promise<ContratoResponse>((resolve) => {
        resolver = resolve;
      }),
    );
    const { component } = setup(
      { contratoId: CONTRATO_ID },
      { registrarAceite },
      { hasToken: true },
    );
    await component.ngOnInit();
    component.abrirConfirmacao();
    const primeira = component.confirmarAceite();
    const segunda = component.confirmarAceite();
    resolver(contratoFixture('ACEITO'));
    await Promise.all([primeira, segunda]);
    expect(registrarAceite).toHaveBeenCalledTimes(1);
  });

  it('403 de step-up limpa o token e leva a nova verificacao', async () => {
    const registrarAceite = vi
      .fn()
      .mockRejectedValue(
        new HttpErrorResponse({ status: 403, error: { message: 'step-up obrigatorio' } }),
      );
    const { component, clear } = setup(
      { contratoId: CONTRATO_ID },
      { registrarAceite },
      { hasToken: true },
    );
    const router = TestBed.inject(Router);
    const navSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    await component.ngOnInit();
    component.abrirConfirmacao();
    await component.confirmarAceite();
    expect(clear).toHaveBeenCalled();
    expect(navSpy).toHaveBeenCalledWith(
      `/app/step-up?next=/app/formalizacao/contratos/${CONTRATO_ID}`,
    );
  });

  it('403 de ownership nao entra em loop de step-up', async () => {
    const registrarAceite = vi
      .fn()
      .mockRejectedValue(
        new HttpErrorResponse({ status: 403, error: { message: 'contrato de outro tomador' } }),
      );
    const { component, clear } = setup(
      { contratoId: CONTRATO_ID },
      { registrarAceite },
      { hasToken: true },
    );
    const router = TestBed.inject(Router);
    const navSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    await component.ngOnInit();
    component.abrirConfirmacao();
    await component.confirmarAceite();
    expect(navSpy).not.toHaveBeenCalled();
    expect(clear).not.toHaveBeenCalled();
    expect(component.erroAceite()).toContain('permissao');
  });

  it('409 recarrega o contrato e exige nova leitura', async () => {
    const consultarPorId = vi
      .fn()
      .mockResolvedValueOnce(contratoFixture('AGUARDANDO_ACEITE'))
      .mockResolvedValueOnce(contratoFixture('AGUARDANDO_ACEITE'));
    const registrarAceite = vi
      .fn()
      .mockRejectedValue(
        new HttpErrorResponse({ status: 409, error: { message: 'versao mudou' } }),
      );
    const { component } = setup(
      { contratoId: CONTRATO_ID },
      { consultarPorId, registrarAceite },
      { hasToken: true },
    );
    await component.ngOnInit();
    component.abrirConfirmacao();
    await component.confirmarAceite();
    expect(consultarPorId).toHaveBeenCalledTimes(2);
    expect(component.confirmacaoAberta()).toBe(false);
    expect(component.erroAceite()).toContain('mudou');
  });

  it('erro de rede nao assume aceite e recarrega antes de nova tentativa', async () => {
    const consultarPorId = vi
      .fn()
      .mockResolvedValueOnce(contratoFixture('AGUARDANDO_ACEITE'))
      .mockResolvedValueOnce(contratoFixture('AGUARDANDO_ACEITE'));
    const registrarAceite = vi.fn().mockRejectedValue(new Error('rede'));
    const { component } = setup(
      { contratoId: CONTRATO_ID },
      { consultarPorId, registrarAceite },
      { hasToken: true },
    );
    await component.ngOnInit();
    component.abrirConfirmacao();
    await component.confirmarAceite();
    expect(consultarPorId).toHaveBeenCalledTimes(2);
    expect(component.erroAceite()).toContain('Tente novamente');
  });

  // ---- M-8.5: status de assinatura e documento ----

  it('a fase de assinatura aparece pos-aceite e nao em AGUARDANDO_ACEITE', async () => {
    const aguardando = setup({ contratoId: CONTRATO_ID });
    await aguardando.component.ngOnInit();
    expect(aguardando.component.mostrarAssinatura()).toBe(false);

    const emAssinatura = setup(
      { contratoId: CONTRATO_ID },
      { consultarPorId: vi.fn().mockResolvedValue(contratoFixture('EM_ASSINATURA')) },
    );
    await emAssinatura.component.ngOnInit();
    expect(emAssinatura.component.mostrarAssinatura()).toBe(true);
  });

  it('atualizarStatus busca o snapshot e expoe o envelope', async () => {
    const consultarStatusAssinatura = vi.fn().mockResolvedValue({
      statusContrato: 'EM_ASSINATURA',
      statusEnvelope: 'ENVIADO',
      idEnvelopeExterno: 'env-externo-1',
      dataAtualizacaoProvider: '2026-06-30T10:00:00-03:00',
    });
    const { component } = setup(
      { contratoId: CONTRATO_ID },
      {
        consultarPorId: vi.fn().mockResolvedValue(contratoFixture('EM_ASSINATURA')),
        consultarStatusAssinatura,
      },
    );
    await component.ngOnInit();
    await component.atualizarStatus();
    expect(consultarStatusAssinatura).toHaveBeenCalledWith(CONTRATO_ID);
    expect(component.statusAssinatura()?.statusEnvelope).toBe('ENVIADO');
  });

  it('falha ao atualizar status preserva o snapshot anterior', async () => {
    const consultarStatusAssinatura = vi
      .fn()
      .mockResolvedValueOnce({
        statusContrato: 'EM_ASSINATURA',
        statusEnvelope: 'ENVIADO',
        idEnvelopeExterno: null,
        dataAtualizacaoProvider: null,
      })
      .mockRejectedValueOnce(new Error('rede'));
    const { component } = setup(
      { contratoId: CONTRATO_ID },
      {
        consultarPorId: vi.fn().mockResolvedValue(contratoFixture('EM_ASSINATURA')),
        consultarStatusAssinatura,
      },
    );
    await component.ngOnInit();
    await component.atualizarStatus();
    await component.atualizarStatus();
    expect(component.statusAssinatura()?.statusEnvelope).toBe('ENVIADO');
    expect(component.erroStatus()).toContain('Tente novamente');
  });

  it('contrato CANCELADO nao exibe a fase de assinatura (cancelamento e pre-aceite)', async () => {
    const { component } = setup(
      { contratoId: CONTRATO_ID },
      { consultarPorId: vi.fn().mockResolvedValue(contratoFixture('CANCELADO')) },
    );
    await component.ngOnInit();
    expect(component.mostrarAssinatura()).toBe(false);
  });

  it('documentoDisponivel apenas quando o status efetivo e ASSINADO', async () => {
    const { component } = setup(
      { contratoId: CONTRATO_ID },
      { consultarPorId: vi.fn().mockResolvedValue(contratoFixture('ASSINADO')) },
    );
    await component.ngOnInit();
    expect(component.documentoDisponivel()).toBe(true);
  });

  it('baixarDocumento cria a URL de objeto, baixa e revoga (sem persistir)', async () => {
    const createObjectURL = vi.fn(() => 'blob:fake-url');
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, configurable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectURL, configurable: true });
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    const baixarDocumentoAssinado = vi.fn().mockResolvedValue(documentoFixture());
    const { component } = setup(
      { contratoId: CONTRATO_ID },
      {
        consultarPorId: vi.fn().mockResolvedValue(contratoFixture('ASSINADO')),
        baixarDocumentoAssinado,
      },
    );
    await component.ngOnInit();
    await component.baixarDocumento();
    expect(baixarDocumentoAssinado).toHaveBeenCalledWith(CONTRATO_ID);
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake-url');
    expect(component.erroDocumento()).toBeNull();
    clickSpy.mockRestore();
  });

  it('baixarDocumento trata 409 (documento indisponivel) sem assumir sucesso', async () => {
    const createObjectURL = vi.fn(() => 'blob:fake-url');
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, configurable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectURL, configurable: true });
    const baixarDocumentoAssinado = vi
      .fn()
      .mockRejectedValue(new HttpErrorResponse({ status: 409 }));
    const { component } = setup(
      { contratoId: CONTRATO_ID },
      {
        consultarPorId: vi.fn().mockResolvedValue(contratoFixture('ASSINADO')),
        baixarDocumentoAssinado,
      },
    );
    await component.ngOnInit();
    await component.baixarDocumento();
    expect(component.erroDocumento()).toContain('disponivel');
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it('baixarDocumento expoe erro quando o service rejeita corpo vazio (sem URL de objeto)', async () => {
    const createObjectURL = vi.fn(() => 'blob:fake-url');
    Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, configurable: true });
    // O service lanca para corpo 200 vazio (documento legal nunca vira download vazio "ok").
    const baixarDocumentoAssinado = vi
      .fn()
      .mockRejectedValue(new Error('Documento assinado indisponivel.'));
    const { component } = setup(
      { contratoId: CONTRATO_ID },
      {
        consultarPorId: vi.fn().mockResolvedValue(contratoFixture('ASSINADO')),
        baixarDocumentoAssinado,
      },
    );
    await component.ngOnInit();
    await component.baixarDocumento();
    expect(component.erroDocumento()).toContain('Tente novamente');
    expect(createObjectURL).not.toHaveBeenCalled();
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

function usuarioFixture(over: Partial<UsuarioResponse> = {}): UsuarioResponse {
  return {
    id: '4f1d4920-3f55-6f48-9b3e-dd1234567890',
    username: 'tomador@sep.test',
    role: 'CLIENTE',
    dataCriacao: '2026-06-30T09:00:00-03:00',
    dataModificacao: '2026-06-30T09:00:00-03:00',
    criadoPor: 'system',
    modificadoPor: 'system',
    precisaRedefinirSenha: false,
    mfaHabilitado: true,
    ...over,
  };
}

function statusAssinaturaFixture() {
  return {
    statusContrato: 'ACEITO',
    statusEnvelope: null,
    idEnvelopeExterno: null,
    dataAtualizacaoProvider: null,
  };
}

function documentoFixture() {
  return {
    blob: new Blob(['%PDF-1.4 ficticio'], { type: 'application/pdf' }),
    nomeArquivo: `contrato-${CONTRATO_ID}-assinado.pdf`,
    hashSha256: 'hash-doc',
  };
}
