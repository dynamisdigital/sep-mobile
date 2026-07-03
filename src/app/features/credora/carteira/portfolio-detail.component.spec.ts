import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { CarteiraCobrancaResumo, OperacaoCarteiraResponse } from '../../../core/api/api.models';
import { AuthService } from '../../../core/auth/auth.service';
import { PortfolioDetailComponent } from './portfolio-detail.component';

const ID = 'op-1';
const URL = `http://localhost:8080/api/v1/credores/carteira/${ID}`;
const authStub = { currentUser: signal(null), logout: async () => undefined };

function cobranca(over: Partial<CarteiraCobrancaResumo> = {}): CarteiraCobrancaResumo {
  return {
    numeroParcelas: 12,
    valorTotal: 12000,
    parcelasPagas: 3,
    parcelasAtrasadas: 1,
    totalRecebido: 3000,
    proximoVencimento: '2026-08-10',
    ...over,
  };
}

function operacao(over: Partial<OperacaoCarteiraResponse> = {}): OperacaoCarteiraResponse {
  return {
    id: ID,
    contratoId: 'contrato-secreto-123',
    oportunidadeId: 'oportunidade-secreta-456',
    status: 'ASSOCIADA',
    justificativa: 'justificativa-secreta-operacional',
    valor: 10000,
    prazoMeses: 12,
    taxaJurosMensal: 0.0199,
    contratoStatus: 'ASSINADO',
    cobranca: cobranca(),
    dataCriacao: '2026-06-30T09:00:00-03:00',
    ...over,
  };
}

describe('PortfolioDetailComponent', () => {
  let fixture: ComponentFixture<PortfolioDetailComponent>;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: authStub },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ operacaoId: ID }) } },
        },
      ],
    });
    fixture = TestBed.createComponent(PortfolioDetailComponent);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  async function render(): Promise<HTMLElement> {
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('exibe status, contratoStatus e agregados de cobranca sem recalcular', async () => {
    fixture.detectChanges();
    httpMock.expectOne(URL).flush(operacao());
    const el = await render();

    expect(el.querySelector('[data-testid="sep-operacao-status"]')?.textContent).toContain(
      'Associada',
    );
    expect(
      el.querySelector('[data-testid="sep-operacao-detalhe-contrato-status"]')?.textContent,
    ).toContain('ASSINADO');
    // agregados exibidos diretamente (valores do backend, sem recalculo)
    expect(el.querySelector('[data-testid="sep-operacao-detalhe-pagas"]')?.textContent).toContain(
      '3',
    );
    expect(
      el.querySelector('[data-testid="sep-operacao-detalhe-atrasadas"]')?.textContent,
    ).toContain('1');
    expect(
      el.querySelector('[data-testid="sep-operacao-detalhe-recebido"]')?.textContent,
    ).toContain('R$');
  });

  it('campos nullable viram "Nao informado"', async () => {
    fixture.detectChanges();
    httpMock
      .expectOne(URL)
      .flush(
        operacao({ valor: null, prazoMeses: null, taxaJurosMensal: null, contratoStatus: null }),
      );
    const el = await render();
    expect(el.querySelector('[data-testid="sep-operacao-detalhe-valor"]')?.textContent).toContain(
      'Nao informado',
    );
    expect(el.querySelector('[data-testid="sep-operacao-detalhe-taxa"]')?.textContent).toContain(
      'Nao informado',
    );
  });

  it('sem cobranca mostra nota, sem inventar agregados', async () => {
    fixture.detectChanges();
    httpMock.expectOne(URL).flush(operacao({ cobranca: null }));
    const el = await render();
    expect(el.querySelector('[data-testid="sep-operacao-detalhe-sem-cobranca"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="sep-operacao-detalhe-cobranca"]')).toBeNull();
  });

  it('operacao encerrada reflete o status', async () => {
    fixture.detectChanges();
    httpMock.expectOne(URL).flush(operacao({ status: 'ENCERRADA' }));
    const el = await render();
    expect(el.querySelector('[data-testid="sep-operacao-status"]')?.textContent).toContain(
      'Encerrada',
    );
  });

  it('404 mostra mensagem neutra e voltar', async () => {
    fixture.detectChanges();
    httpMock.expectOne(URL).flush({ message: 'x' }, { status: 404, statusText: 'Not Found' });
    const el = await render();
    expect(el.querySelector('[data-testid="sep-operacao-detalhe-erro"]')?.textContent).toContain(
      'indisponivel',
    );
    expect(el.querySelector('[data-testid="sep-operacao-detalhe-voltar"]')).not.toBeNull();
  });

  it('nao expoe IDs internos, justificativa nem dados do tomador', async () => {
    fixture.detectChanges();
    httpMock.expectOne(URL).flush(operacao());
    const el = await render();
    expect(el.innerHTML).not.toContain('contrato-secreto-123');
    expect(el.innerHTML).not.toContain('oportunidade-secreta-456');
    expect(el.innerHTML).not.toContain('justificativa-secreta-operacional');
  });

  it('reentrada na stack reconsulta a operacao', async () => {
    fixture.detectChanges();
    httpMock.expectOne(URL).flush(operacao());
    await render();

    fixture.componentInstance.ionViewWillEnter();
    httpMock.expectOne(URL).flush(operacao({ status: 'ENCERRADA' }));
    const el = await render();
    expect(el.querySelector('[data-testid="sep-operacao-status"]')?.textContent).toContain(
      'Encerrada',
    );
  });
});
