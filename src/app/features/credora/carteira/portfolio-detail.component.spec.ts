import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  CarteiraCobrancaResumo,
  OperacaoCarteiraResponse,
  PixOperacaoCredoraResponse,
} from '../../../core/api/api.models';
import { AuthService } from '../../../core/auth/auth.service';
import { PortfolioDetailComponent } from './portfolio-detail.component';

const ID = 'op-1';
const URL = `http://localhost:8080/api/v1/credores/carteira/${ID}`;
const PIX_URL = `${URL}/pix`;
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

function pixFixture(over: Partial<PixOperacaoCredoraResponse> = {}): PixOperacaoCredoraResponse {
  return {
    status: 'LIQUIDADO',
    valor: 10000,
    atualizadoEm: '2026-07-06T10:00:00-03:00',
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

  // Carrega a operacao (200) e responde o status Pix (P3, GET dedicado). `pix` pode ser um objeto
  // (200) ou um status HTTP (para simular 404/5xx do Pix). Retorna o elemento renderizado.
  async function renderOperacao(
    op: OperacaoCarteiraResponse = operacao(),
    pix: PixOperacaoCredoraResponse | number = pixFixture(),
  ): Promise<HTMLElement> {
    fixture.detectChanges();
    httpMock.expectOne(URL).flush(op);
    await fixture.whenStable();
    const req = httpMock.expectOne(PIX_URL);
    if (typeof pix === 'number') {
      req.flush({ message: 'x' }, { status: pix, statusText: 'Error' });
    } else {
      req.flush(pix);
    }
    return render();
  }

  it('exibe status, contratoStatus e agregados de cobranca sem recalcular', async () => {
    const el = await renderOperacao();

    expect(el.querySelector('[data-testid="sep-operacao-status"]')?.textContent).toContain(
      'Associada',
    );
    expect(
      el.querySelector('[data-testid="sep-operacao-detalhe-contrato-status"]')?.textContent,
    ).toContain('ASSINADO');
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
    const el = await renderOperacao(
      operacao({ valor: null, prazoMeses: null, taxaJurosMensal: null, contratoStatus: null }),
    );
    expect(el.querySelector('[data-testid="sep-operacao-detalhe-valor"]')?.textContent).toContain(
      'Nao informado',
    );
    expect(el.querySelector('[data-testid="sep-operacao-detalhe-taxa"]')?.textContent).toContain(
      'Nao informado',
    );
  });

  it('sem cobranca mostra nota, sem inventar agregados', async () => {
    const el = await renderOperacao(operacao({ cobranca: null }));
    expect(el.querySelector('[data-testid="sep-operacao-detalhe-sem-cobranca"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="sep-operacao-detalhe-cobranca"]')).toBeNull();
  });

  it('operacao encerrada reflete o status', async () => {
    const el = await renderOperacao(operacao({ status: 'ENCERRADA' }));
    expect(el.querySelector('[data-testid="sep-operacao-status"]')?.textContent).toContain(
      'Encerrada',
    );
  });

  it('404 mostra mensagem neutra e voltar; nao consulta o status Pix', async () => {
    fixture.detectChanges();
    httpMock.expectOne(URL).flush({ message: 'x' }, { status: 404, statusText: 'Not Found' });
    const el = await render();
    expect(el.querySelector('[data-testid="sep-operacao-detalhe-erro"]')?.textContent).toContain(
      'indisponivel',
    );
    expect(el.querySelector('[data-testid="sep-operacao-detalhe-voltar"]')).not.toBeNull();
    // Operacao null: nenhum GET de status Pix e disparado (httpMock.verify no afterEach confirma).
    expect(fixture.componentInstance.statusPix()).toBeNull();
  });

  it('nao expoe IDs internos, justificativa nem dados do tomador', async () => {
    const el = await renderOperacao();
    expect(el.innerHTML).not.toContain('contrato-secreto-123');
    expect(el.innerHTML).not.toContain('oportunidade-secreta-456');
    expect(el.innerHTML).not.toContain('justificativa-secreta-operacional');
  });

  it('reentrada na stack reconsulta a operacao e o status Pix', async () => {
    await renderOperacao();

    fixture.componentInstance.ionViewWillEnter();
    httpMock.expectOne(URL).flush(operacao({ status: 'ENCERRADA' }));
    await fixture.whenStable();
    httpMock.expectOne(PIX_URL).flush(pixFixture());
    const el = await render();
    expect(el.querySelector('[data-testid="sep-operacao-status"]')?.textContent).toContain(
      'Encerrada',
    );
  });

  // --- Status Pix da operacao (M-11.4 — backend Gate P3) ---

  it('exibe o status Pix publico da operacao (status, valor e data)', async () => {
    const el = await renderOperacao(operacao(), pixFixture({ status: 'EM_PROCESSAMENTO' }));
    expect(el.querySelector('[data-testid="sep-pix-status-publico"]')?.textContent).toContain(
      'Em processamento',
    );
    expect(
      el.querySelector('[data-testid="sep-operacao-detalhe-pix-valor"]')?.textContent,
    ).toContain('R$');
  });

  it('404 do status Pix vira ausencia neutra (sem status Pix), nao erro', async () => {
    const el = await renderOperacao(operacao(), 404);
    expect(
      el.querySelector('[data-testid="sep-operacao-detalhe-pix-indisponivel"]'),
    ).not.toBeNull();
    expect(el.querySelector('[data-testid="sep-operacao-detalhe-pix-erro"]')).toBeNull();
    expect(fixture.componentInstance.pixIndisponivel()).toBe(true);
  });

  it('rede/5xx do status Pix vira erro isolado; o detalhe da operacao permanece intacto', async () => {
    const el = await renderOperacao(operacao(), 500);
    expect(el.querySelector('[data-testid="sep-operacao-detalhe-pix-erro"]')).not.toBeNull();
    // O detalhe da operacao segue visivel e utilizavel.
    expect(el.querySelector('[data-testid="sep-operacao-detalhe-valor"]')).not.toBeNull();
    expect(fixture.componentInstance.erro()).toBeNull();

    // Retry recarrega apenas o status Pix.
    const p = fixture.componentInstance.consultarStatusPix();
    httpMock.expectOne(PIX_URL).flush(pixFixture({ status: 'LIQUIDADO' }));
    await p;
    const el2 = await render();
    expect(el2.querySelector('[data-testid="sep-pix-status-publico"]')?.textContent).toContain(
      'Liquidado',
    );
  });

  it('retry com 5xx apos um 404 mostra o erro tecnico, nao a ausencia neutra', async () => {
    await renderOperacao(operacao(), 404);
    expect(fixture.componentInstance.pixIndisponivel()).toBe(true);

    // Retry falha com 5xx: a ausencia anterior nao pode mais mascarar o erro tecnico.
    const p = fixture.componentInstance.consultarStatusPix();
    httpMock.expectOne(PIX_URL).flush({ message: 'x' }, { status: 500, statusText: 'Error' });
    await p;
    const el = await render();
    expect(fixture.componentInstance.pixIndisponivel()).toBe(false);
    expect(el.querySelector('[data-testid="sep-operacao-detalhe-pix-erro"]')).not.toBeNull();
  });

  it('o card de status Pix nao expoe tomador, contrato, transferencia, provider nem escrow', async () => {
    const el = await renderOperacao(operacao(), pixFixture());
    const card = el.querySelector('[data-testid="sep-operacao-detalhe-pix"]');
    const html = (card?.innerHTML ?? '').toLowerCase();
    expect(html).not.toContain('contrato-secreto');
    expect(html).not.toContain('txid');
    expect(html).not.toContain('endtoend');
    expect(html).not.toContain('escrow');
    expect(html).not.toContain('tomador');
  });
});
