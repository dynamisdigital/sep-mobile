import { HttpErrorResponse } from '@angular/common/http';
import { EnvironmentInjector, runInInjectionContext, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RenegociacaoTomadorResponse, UsuarioResponse } from '../../../core/api/api.models';
import { AuthService } from '../../../core/auth/auth.service';
import { StepUpTokenStore } from '../../../core/auth/step-up-token.store';
import { CobrancaMobileService } from '../../../core/cobranca/cobranca-mobile.service';
import { RenegociacaoDetailComponent } from './renegociacao-detail.component';

const CONTRATO_ID = '1f155daf-c0e8-6f15-be21-5f51a516a416';
const PARCELA_ID = '3f155daf-c0e8-6f15-be21-5f51a516a417';
const RENEGOCIACAO_ID = '6f155daf-c0e8-6f15-be21-5f51a516a41b';
const ROTA_RENEGOCIACAO = `/app/parcelas/contratos/${CONTRATO_ID}/parcelas/${PARCELA_ID}/renegociacao`;

// Instance-based: Ionic nao monta no happy-dom. UI renderizada validada no smoke Playwright (M-9.6).
function setup(
  svc: Partial<Record<keyof CobrancaMobileService, ReturnType<typeof vi.fn>>> = {},
  opts: { user?: UsuarioResponse | null; hasToken?: boolean } = {},
) {
  const cobranca = {
    consultarRenegociacaoAtiva:
      svc.consultarRenegociacaoAtiva ?? vi.fn().mockResolvedValue(renegociacaoFixture()),
    aceitarRenegociacao: svc.aceitarRenegociacao ?? vi.fn().mockResolvedValue(undefined),
    recusarRenegociacao: svc.recusarRenegociacao ?? vi.fn().mockResolvedValue(undefined),
  };
  const activatedRoute = {
    snapshot: {
      paramMap: {
        get: (k: string) =>
          ({ contratoId: CONTRATO_ID, parcelaId: PARCELA_ID })[k as 'contratoId' | 'parcelaId'] ??
          null,
      },
    },
  };
  const user = opts.user === undefined ? usuarioFixture() : opts.user;
  const clear = vi.fn();
  const stepUpStore = { hasToken: () => !!opts.hasToken, clear, set: vi.fn(), consume: vi.fn() };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: CobrancaMobileService, useValue: cobranca },
      { provide: ActivatedRoute, useValue: activatedRoute },
      { provide: AuthService, useValue: { currentUser: signal(user) } },
      { provide: StepUpTokenStore, useValue: stepUpStore },
    ],
  });
  const injector = TestBed.inject(EnvironmentInjector);
  const component = runInInjectionContext(injector, () => new RenegociacaoDetailComponent());
  return { component, cobranca, stepUpStore, clear };
}

describe('RenegociacaoDetailComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('carrega os termos completos ao entrar, com total vindo do backend', async () => {
    const { component, cobranca } = setup();
    await component.ngOnInit();
    expect(cobranca.consultarRenegociacaoAtiva).toHaveBeenCalledWith(PARCELA_ID);
    const r = component.renegociacao();
    expect(r).toEqual(renegociacaoFixture());
    // Total exibido e o do backend; o app nao deriva valor x quantidade (110 x 3 = 330 é
    // coincidencia da fixture — a assercao cobre o campo, nao o calculo).
    expect(r?.valorTotalRenegociado).toBe(330);
  });

  it('DTO expoe apenas os 10 campos publicos do contrato B2 (sem IDs internos)', async () => {
    const { component } = setup();
    await component.ngOnInit();
    const chaves = Object.keys(component.renegociacao()!);
    expect(chaves.sort()).toEqual([
      'dataExpiracao',
      'dataProposta',
      'desconto',
      'novoValorParcela',
      'novoVencimento',
      'numeroParcelas',
      'parcelaId',
      'renegociacaoId',
      'status',
      'valorTotalRenegociado',
    ]);
    expect(chaves).not.toContain('tomadorId');
    expect(chaves).not.toContain('propostaPor');
    expect(chaves).not.toContain('agendaOriginalId');
    expect(chaves).not.toContain('justificativa');
  });

  it('404 na carga vira estado indisponivel com retorno a parcela (sem erro cheio)', async () => {
    const { component } = setup({
      consultarRenegociacaoAtiva: vi.fn().mockRejectedValue(new HttpErrorResponse({ status: 404 })),
    });
    await component.ngOnInit();
    expect(component.indisponivel()).toBe(true);
    expect(component.renegociacao()).toBeNull();
    expect(component.erro()).toBeNull();
  });

  it('403 na carga mostra mensagem neutra de ownership', async () => {
    const { component } = setup({
      consultarRenegociacaoAtiva: vi.fn().mockRejectedValue(new HttpErrorResponse({ status: 403 })),
    });
    await component.ngOnInit();
    expect(component.erro()).toBe('Voce nao tem acesso a esta renegociacao.');
  });

  it('abrir confirmacao de aceite reconsulta os termos antes (sem snapshot velho)', async () => {
    const { component, cobranca } = setup({}, { hasToken: true });
    await component.ngOnInit();
    await component.abrirConfirmacaoAceite();
    // 1x no init + 1x antes de abrir a confirmacao.
    expect(cobranca.consultarRenegociacaoAtiva).toHaveBeenCalledTimes(2);
    expect(component.confirmacaoAceiteAberta()).toBe(true);
  });

  it('se a proposta expira antes da confirmacao, a confirmacao nao abre', async () => {
    const consultarRenegociacaoAtiva = vi
      .fn()
      .mockResolvedValueOnce(renegociacaoFixture())
      .mockRejectedValueOnce(new HttpErrorResponse({ status: 404 }));
    const { component } = setup({ consultarRenegociacaoAtiva }, { hasToken: true });
    await component.ngOnInit();
    await component.abrirConfirmacaoAceite();
    expect(component.confirmacaoAceiteAberta()).toBe(false);
    expect(component.indisponivel()).toBe(true);
  });

  it('aceite sem MFA e bloqueado com orientacao (sem bypass, sem PATCH)', async () => {
    const { component, cobranca } = setup(
      {},
      { user: usuarioFixture({ mfaHabilitado: false }), hasToken: false },
    );
    await component.ngOnInit();
    await component.abrirConfirmacaoAceite();
    await component.confirmarAceite();
    expect(component.erroDecisao()).toContain('MFA');
    expect(cobranca.aceitarRenegociacao).not.toHaveBeenCalled();
  });

  it('aceite sem token navega ao step-up com next da renegociacao (sem PATCH)', async () => {
    const { component, cobranca } = setup({}, { hasToken: false });
    const router = TestBed.inject(Router);
    const navSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    await component.ngOnInit();
    await component.abrirConfirmacaoAceite();
    await component.confirmarAceite();
    expect(navSpy).toHaveBeenCalledWith(`/app/step-up?next=${ROTA_RENEGOCIACAO}`);
    expect(cobranca.aceitarRenegociacao).not.toHaveBeenCalled();
  });

  it('retorno do step-up nao aceita automaticamente: init apenas recarrega termos', async () => {
    const { component, cobranca } = setup({}, { hasToken: true });
    await component.ngOnInit();
    // Mesmo com token disponivel, nenhum PATCH sem novo toque do usuario.
    expect(cobranca.aceitarRenegociacao).not.toHaveBeenCalled();
    expect(component.confirmacaoAceiteAberta()).toBe(false);
  });

  it('aceite confirmado com token chama o PATCH uma vez e navega para a agenda ativa', async () => {
    const { component, cobranca } = setup({}, { hasToken: true });
    const router = TestBed.inject(Router);
    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    await component.ngOnInit();
    await component.abrirConfirmacaoAceite();
    await component.confirmarAceite();
    expect(cobranca.aceitarRenegociacao).toHaveBeenCalledExactlyOnceWith(RENEGOCIACAO_ID);
    expect(navSpy).toHaveBeenCalledWith(['/app/parcelas/contratos', CONTRATO_ID]);
  });

  it('duplo submit de aceite e bloqueado enquanto decide', async () => {
    let resolverPatch: () => void = () => undefined;
    const aceitarRenegociacao = vi.fn().mockReturnValue(
      new Promise<void>((resolve) => {
        resolverPatch = resolve;
      }),
    );
    const { component } = setup({ aceitarRenegociacao }, { hasToken: true });
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    await component.ngOnInit();
    await component.abrirConfirmacaoAceite();
    const primeira = component.confirmarAceite();
    const segunda = component.confirmarAceite(); // guard decidindo() barra
    resolverPatch();
    await Promise.all([primeira, segunda]);
    expect(aceitarRenegociacao).toHaveBeenCalledTimes(1);
  });

  it('recusa e explicita, nao consulta MFA/step-up e nao consome token', async () => {
    const { component, cobranca, stepUpStore } = setup(
      {},
      { user: usuarioFixture({ mfaHabilitado: false }), hasToken: true },
    );
    const router = TestBed.inject(Router);
    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    await component.ngOnInit();
    await component.abrirConfirmacaoRecusa();
    expect(component.confirmacaoRecusaAberta()).toBe(true);
    await component.confirmarRecusa();
    // Recusa funciona mesmo sem MFA e nao passa pelo store de step-up.
    expect(cobranca.recusarRenegociacao).toHaveBeenCalledExactlyOnceWith(RENEGOCIACAO_ID);
    expect(stepUpStore.consume).not.toHaveBeenCalled();
    expect(navSpy).toHaveBeenCalledWith([
      '/app/parcelas/contratos',
      CONTRATO_ID,
      'parcelas',
      PARCELA_ID,
    ]);
  });

  it('403 de step-up no aceite limpa o token e reinicia a verificacao', async () => {
    const { component, clear } = setup(
      {
        aceitarRenegociacao: vi.fn().mockRejectedValue(
          new HttpErrorResponse({
            status: 403,
            error: { message: 'Step-up requerido para esta operacao' },
          }),
        ),
      },
      { hasToken: true },
    );
    const router = TestBed.inject(Router);
    const navSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    await component.ngOnInit();
    await component.abrirConfirmacaoAceite();
    await component.confirmarAceite();
    expect(clear).toHaveBeenCalled();
    expect(navSpy).toHaveBeenCalledWith(`/app/step-up?next=${ROTA_RENEGOCIACAO}`);
  });

  it('403 de ownership no aceite mostra mensagem neutra sem loop de step-up', async () => {
    const { component, clear } = setup(
      {
        aceitarRenegociacao: vi
          .fn()
          .mockRejectedValue(new HttpErrorResponse({ status: 403, error: { message: 'negado' } })),
      },
      { hasToken: true },
    );
    await component.ngOnInit();
    await component.abrirConfirmacaoAceite();
    await component.confirmarAceite();
    expect(component.erroDecisao()).toContain('permissao');
    expect(clear).not.toHaveBeenCalled();
  });

  it('409 (decisao concorrente/expiracao) recarrega os termos e orienta conferir', async () => {
    const consultarRenegociacaoAtiva = vi
      .fn()
      .mockResolvedValueOnce(renegociacaoFixture())
      .mockResolvedValueOnce(renegociacaoFixture())
      .mockRejectedValueOnce(new HttpErrorResponse({ status: 404 }));
    const { component } = setup(
      {
        consultarRenegociacaoAtiva,
        aceitarRenegociacao: vi.fn().mockRejectedValue(new HttpErrorResponse({ status: 409 })),
      },
      { hasToken: true },
    );
    await component.ngOnInit();
    await component.abrirConfirmacaoAceite();
    await component.confirmarAceite();
    // Pos-409 os termos foram reconsultados (3a chamada -> 404) e o estado reflete o backend.
    expect(consultarRenegociacaoAtiva).toHaveBeenCalledTimes(3);
    expect(component.indisponivel()).toBe(true);
    expect(component.erroDecisao()).toContain('mudou ou expirou');
  });

  it('rede/5xx nunca vira sucesso presumido: recarrega e mantem a tela para retry', async () => {
    const { component, cobranca } = setup(
      { recusarRenegociacao: vi.fn().mockRejectedValue(new Error('rede')) },
      { hasToken: false },
    );
    const router = TestBed.inject(Router);
    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    await component.ngOnInit();
    await component.abrirConfirmacaoRecusa();
    await component.confirmarRecusa();
    expect(navSpy).not.toHaveBeenCalled();
    expect(component.erroDecisao()).toContain('tente novamente');
    // Termos reconsultados para refletir o estado real.
    expect(cobranca.consultarRenegociacaoAtiva).toHaveBeenCalledTimes(3);
  });

  it('cancelar confirmacao nao chama nenhuma API de decisao', async () => {
    const { component, cobranca } = setup({}, { hasToken: true });
    await component.ngOnInit();
    await component.abrirConfirmacaoAceite();
    component.cancelarConfirmacao();
    expect(component.confirmacaoAceiteAberta()).toBe(false);
    expect(cobranca.aceitarRenegociacao).not.toHaveBeenCalled();
    expect(cobranca.recusarRenegociacao).not.toHaveBeenCalled();
  });
});

function renegociacaoFixture(): RenegociacaoTomadorResponse {
  return {
    renegociacaoId: RENEGOCIACAO_ID,
    parcelaId: PARCELA_ID,
    status: 'PROPOSTA',
    novoValorParcela: 110,
    numeroParcelas: 3,
    valorTotalRenegociado: 330,
    novoVencimento: '2026-08-01',
    desconto: 0,
    dataProposta: '2026-07-01T10:00:00-03:00',
    dataExpiracao: '2026-07-08T10:00:00-03:00',
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
