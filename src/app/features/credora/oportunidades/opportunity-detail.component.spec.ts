import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  EmpresaCredoraResponse,
  InteresseResponse,
  OportunidadeResponse,
} from '../../../core/api/api.models';
import { AuthService } from '../../../core/auth/auth.service';
import { CredoraContextStore } from '../../../core/credores/credora-context.store';
import { CredoraMobileService } from '../../../core/credores/credora-mobile.service';
import { OpportunityDetailComponent } from './opportunity-detail.component';

const ID = 'op-1';
const authStub = { currentUser: signal(null), logout: async () => undefined };

function oportunidade(over: Partial<OportunidadeResponse> = {}): OportunidadeResponse {
  return {
    id: ID,
    propostaId: 'proposta-secreta-123',
    contratoId: 'contrato-secreto-456',
    valor: 10000,
    prazoMeses: 12,
    taxaJurosMensal: 0.0199,
    status: 'DISPONIVEL',
    dataCriacao: '2026-06-30T09:00:00-03:00',
    ...over,
  };
}

function interesseAtivo(): InteresseResponse {
  return {
    id: 'int-1',
    oportunidadeId: ID,
    status: 'ATIVO',
    dataCriacao: '2026-07-01T09:00:00-03:00',
  };
}

function credora(over: Partial<EmpresaCredoraResponse> = {}): EmpresaCredoraResponse {
  return {
    id: 'cred-1',
    usuarioId: 'u1',
    onboardingId: 'o1',
    cnpj: '11.222.333/0001-81',
    razaoSocial: 'Credora Alfa LTDA',
    status: 'ATIVA',
    elegibilidade: 'ELEGIVEL',
    motivoInelegibilidade: null,
    tipoCredora: 'EMPRESA',
    capacidadeAporte: 100000,
    dataCriacao: '2026-06-30T09:00:00-03:00',
    dataModificacao: '2026-06-30T09:00:00-03:00',
    ...over,
  };
}

function erro(status: number): HttpErrorResponse {
  return new HttpErrorResponse({ status });
}

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe('OpportunityDetailComponent (interesse M-10.4)', () => {
  let fixture: ComponentFixture<OpportunityDetailComponent>;
  let comp: OpportunityDetailComponent;
  let service: {
    consultarOportunidade: ReturnType<typeof vi.fn>;
    consultarInteresseAtivo: ReturnType<typeof vi.fn>;
    registrarInteresse: ReturnType<typeof vi.fn>;
    cancelarInteresse: ReturnType<typeof vi.fn>;
  };
  let store: {
    carregar: ReturnType<typeof vi.fn>;
    credora: ReturnType<typeof signal>;
    estado: ReturnType<typeof signal>;
  };

  beforeEach(() => {
    service = {
      consultarOportunidade: vi.fn().mockResolvedValue(oportunidade()),
      consultarInteresseAtivo: vi.fn().mockRejectedValue(erro(404)), // ausente por padrao
      registrarInteresse: vi.fn().mockResolvedValue(interesseAtivo()),
      cancelarInteresse: vi.fn().mockResolvedValue(undefined),
    };
    store = {
      carregar: vi.fn().mockResolvedValue('presente'),
      credora: signal<EmpresaCredoraResponse | null>(credora()),
      estado: signal('presente'),
    };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authStub },
        { provide: CredoraMobileService, useValue: service },
        { provide: CredoraContextStore, useValue: store },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ oportunidadeId: ID }) } },
        },
      ],
    });
    fixture = TestBed.createComponent(OpportunityDetailComponent);
    comp = fixture.componentInstance;
  });

  afterEach(() => vi.clearAllMocks());

  async function render(): Promise<HTMLElement> {
    fixture.detectChanges();
    await comp.carregar();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  async function tick(): Promise<HTMLElement> {
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('sem interesse (404) mostra Manifestar, nao Cancelar', async () => {
    const el = await render();
    expect(el.querySelector('[data-testid="sep-interesse-manifestar"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="sep-interesse-cancelar"]')).toBeNull();
  });

  it('com interesse ativo mostra Cancelar, nao Manifestar', async () => {
    service.consultarInteresseAtivo.mockResolvedValue(interesseAtivo());
    const el = await render();
    expect(el.querySelector('[data-testid="sep-interesse-cancelar"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="sep-interesse-manifestar"]')).toBeNull();
  });

  it('manifestar 201 abre confirmacao, envia e reflete estado autoritativo ATIVO', async () => {
    await render();
    await comp.abrirManifestar();
    let el = await tick();
    expect(el.querySelector('[data-testid="sep-interesse-confirm-manifestar"]')).not.toBeNull();

    // apos confirmar, a leitura autoritativa passa a retornar ATIVO
    service.consultarInteresseAtivo.mockResolvedValue(interesseAtivo());
    await comp.confirmarManifestar();
    el = await tick();
    expect(service.registrarInteresse).toHaveBeenCalledWith(ID);
    expect(el.querySelector('[data-testid="sep-interesse-ativo"]')).not.toBeNull();
  });

  it('409 duplicidade nao assume sucesso: reconsulta e mostra ATIVO', async () => {
    await render();
    await comp.abrirManifestar();
    service.registrarInteresse.mockRejectedValue(erro(409));
    service.consultarInteresseAtivo.mockResolvedValue(interesseAtivo());
    await comp.confirmarManifestar();
    const el = await tick();
    expect(el.querySelector('[data-testid="sep-interesse-ativo"]')).not.toBeNull();
  });

  it('422 inelegivel informa mensagem e mantem estado sem interesse', async () => {
    await render();
    await comp.abrirManifestar();
    service.registrarInteresse.mockRejectedValue(erro(422));
    await comp.confirmarManifestar();
    const el = await tick();
    expect(el.querySelector('[data-testid="sep-interesse-msg"]')?.textContent).toContain(
      'nao elegivel',
    );
    expect(el.querySelector('[data-testid="sep-interesse-manifestar"]')).not.toBeNull();
  });

  it('rede/5xx nunca assume interesse registrado', async () => {
    await render();
    await comp.abrirManifestar();
    service.registrarInteresse.mockRejectedValue(erro(500));
    await comp.confirmarManifestar();
    const el = await tick();
    expect(el.querySelector('[data-testid="sep-interesse-msg"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="sep-interesse-manifestar"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="sep-interesse-ativo"]')).toBeNull();
  });

  it('cancelar 204 reconsulta e volta a Manifestar', async () => {
    service.consultarInteresseAtivo.mockResolvedValue(interesseAtivo());
    await render();
    await comp.abrirCancelar();
    // apos cancelar, a leitura autoritativa passa a 404 (ausente)
    service.consultarInteresseAtivo.mockRejectedValue(erro(404));
    await comp.confirmarCancelar();
    const el = await tick();
    expect(service.cancelarInteresse).toHaveBeenCalledWith(ID);
    expect(el.querySelector('[data-testid="sep-interesse-manifestar"]')).not.toBeNull();
  });

  it('cancelar 404 concorrente reconsulta o estado', async () => {
    service.consultarInteresseAtivo.mockResolvedValue(interesseAtivo());
    await render();
    await comp.abrirCancelar();
    service.cancelarInteresse.mockRejectedValue(erro(404));
    service.consultarInteresseAtivo.mockRejectedValue(erro(404));
    await comp.confirmarCancelar();
    const el = await tick();
    expect(el.querySelector('[data-testid="sep-interesse-manifestar"]')).not.toBeNull();
  });

  it('cancelar a confirmacao nao chama a API', async () => {
    await render();
    await comp.abrirManifestar();
    comp.cancelarConfirmacao();
    const el = await tick();
    expect(el.querySelector('[data-testid="sep-interesse-confirm-manifestar"]')).toBeNull();
    expect(service.registrarInteresse).not.toHaveBeenCalled();
  });

  it('bloqueia duplo submit da manifestacao', async () => {
    await render();
    await comp.abrirManifestar();
    const d = deferred<InteresseResponse>();
    service.registrarInteresse.mockReturnValue(d.promise);
    const p1 = comp.confirmarManifestar();
    const p2 = comp.confirmarManifestar(); // enviando() true -> ignorado
    d.resolve(interesseAtivo());
    await Promise.all([p1, p2]);
    expect(service.registrarInteresse).toHaveBeenCalledTimes(1);
  });

  it('credora inelegivel desabilita Manifestar', async () => {
    store.credora.set(credora({ status: 'SUSPENSA', elegibilidade: 'INELEGIVEL' }));
    const el = await render();
    expect(comp.podeManifestar()).toBe(false);
    expect(el.querySelector('[data-testid="sep-interesse-indisponivel"]')).not.toBeNull();
  });

  it('oportunidade encerrada desabilita Manifestar', async () => {
    service.consultarOportunidade.mockResolvedValue(oportunidade({ status: 'ENCERRADA' }));
    const el = await render();
    expect(el.querySelector('[data-testid="sep-oportunidade-detalhe-encerrada"]')).not.toBeNull();
    expect(comp.podeManifestar()).toBe(false);
  });

  it('404 da oportunidade mostra mensagem neutra e voltar', async () => {
    service.consultarOportunidade.mockRejectedValue(erro(404));
    const el = await render();
    expect(
      el.querySelector('[data-testid="sep-oportunidade-detalhe-erro"]')?.textContent,
    ).toContain('indisponivel');
    expect(el.querySelector('[data-testid="sep-oportunidade-detalhe-voltar"]')).not.toBeNull();
  });

  it('exibe valor/taxa e nao expoe propostaId/contratoId', async () => {
    const el = await render();
    expect(
      el.querySelector('[data-testid="sep-oportunidade-detalhe-valor"]')?.textContent,
    ).toContain('R$');
    expect(
      el.querySelector('[data-testid="sep-oportunidade-detalhe-taxa"]')?.textContent,
    ).toContain('1,99%');
    expect(el.innerHTML).not.toContain('proposta-secreta-123');
    expect(el.innerHTML).not.toContain('contrato-secreto-456');
  });

  it('reentrada na stack reconsulta a oportunidade', async () => {
    await render();
    service.consultarOportunidade.mockResolvedValue(oportunidade({ status: 'ENCERRADA' }));
    comp.ionViewWillEnter();
    await comp.carregar();
    const el = await tick();
    expect(el.querySelector('[data-testid="sep-oportunidade-detalhe-encerrada"]')).not.toBeNull();
  });
});
