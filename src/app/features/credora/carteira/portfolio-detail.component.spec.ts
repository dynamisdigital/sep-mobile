import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  TestRequest,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  AporteCredoraResponse,
  CarteiraCobrancaResumo,
  OperacaoCarteiraResponse,
  PixOperacaoCredoraResponse,
  StatusAporteCredora,
} from '../../../core/api/api.models';
import { AuthService } from '../../../core/auth/auth.service';
import { PortfolioDetailComponent } from './portfolio-detail.component';

const ID = 'op-1';
const URL = `http://localhost:8080/api/v1/credores/carteira/${ID}`;
const PIX_URL = `${URL}/pix`;
const APORTES_URL = `http://localhost:8080/api/v1/credores/operacoes/${ID}/aportes`;
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

function aporte(
  status: StatusAporteCredora = 'LIQUIDADO',
  over: Partial<AporteCredoraResponse> = {},
): AporteCredoraResponse {
  return {
    id: `aporte-${status}`,
    operacaoId: ID,
    status,
    valor: 5000,
    dataCriacao: '2026-07-01T09:00:00-03:00',
    dataAtualizacao: '2026-07-05T09:00:00-03:00',
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

  // Carrega a operacao (200), o status Pix (P3) e os aportes owner-scoped (M-16.4), cada um em GET
  // dedicado. `pix` e `aportes` aceitam um corpo (200) ou um status HTTP (para simular 404/5xx do
  // card isolado). Retorna o elemento renderizado.
  async function renderOperacao(
    op: OperacaoCarteiraResponse = operacao(),
    pix: PixOperacaoCredoraResponse | number = pixFixture(),
    aportes: AporteCredoraResponse[] | number = [aporte()],
  ): Promise<HTMLElement> {
    fixture.detectChanges();
    httpMock.expectOne(URL).flush(op);
    await fixture.whenStable();
    responder(httpMock.expectOne(PIX_URL), pix);
    await fixture.whenStable();
    responder(httpMock.expectOne(APORTES_URL), aportes);
    return render();
  }

  function responder(req: TestRequest, corpo: unknown): void {
    if (typeof corpo === 'number') {
      req.flush({ message: 'x' }, { status: corpo, statusText: 'Error' });
    } else {
      req.flush(corpo);
    }
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

  it('404 mostra mensagem neutra e voltar; nao consulta status Pix nem aportes', async () => {
    fixture.detectChanges();
    httpMock.expectOne(URL).flush({ message: 'x' }, { status: 404, statusText: 'Not Found' });
    const el = await render();
    expect(el.querySelector('[data-testid="sep-operacao-detalhe-erro"]')?.textContent).toContain(
      'indisponivel',
    );
    expect(el.querySelector('[data-testid="sep-operacao-detalhe-voltar"]')).not.toBeNull();
    // Operacao null: nenhum GET secundario e disparado (httpMock.verify no afterEach confirma).
    expect(fixture.componentInstance.statusPix()).toBeNull();
    expect(fixture.componentInstance.aportes()).toEqual([]);
  });

  it('nao expoe IDs internos, justificativa nem dados do tomador', async () => {
    const el = await renderOperacao();
    expect(el.innerHTML).not.toContain('contrato-secreto-123');
    expect(el.innerHTML).not.toContain('oportunidade-secreta-456');
    expect(el.innerHTML).not.toContain('justificativa-secreta-operacional');
  });

  it('reentrada na stack reconsulta a operacao, o status Pix e os aportes', async () => {
    await renderOperacao();

    fixture.componentInstance.ionViewWillEnter();
    httpMock.expectOne(URL).flush(operacao({ status: 'ENCERRADA' }));
    await fixture.whenStable();
    httpMock.expectOne(PIX_URL).flush(pixFixture());
    await fixture.whenStable();
    httpMock.expectOne(APORTES_URL).flush([aporte('PENDENTE')]);
    const el = await render();
    expect(el.querySelector('[data-testid="sep-operacao-status"]')?.textContent).toContain(
      'Encerrada',
    );
    expect(el.querySelector('[data-testid="sep-aporte-status"]')?.textContent).toContain(
      'Pendente',
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

  // --- Aportes owner-scoped da operacao (M-16.4 — backend Sprint 29) ---

  it('lista os aportes na ordem recebida do backend, sem reordenar', async () => {
    const el = await renderOperacao(operacao(), pixFixture(), [
      aporte('LIQUIDADO', { id: 'a1' }),
      aporte('PENDENTE', { id: 'a2' }),
      aporte('FALHOU', { id: 'a3' }),
    ]);

    const badges = [...el.querySelectorAll('[data-testid="sep-aporte-status"]')].map((b) =>
      b.textContent?.trim(),
    );
    expect(badges).toEqual(['Liquidado', 'Pendente', 'Falhou']);
  });

  it('renderiza os quatro estados de aporte com rotulo textual, nao so cor', async () => {
    const el = await renderOperacao(operacao(), pixFixture(), [
      aporte('PENDENTE', { id: 'a1' }),
      aporte('EM_PROCESSAMENTO', { id: 'a2' }),
      aporte('LIQUIDADO', { id: 'a3' }),
      aporte('FALHOU', { id: 'a4' }),
    ]);

    const badges = [...el.querySelectorAll('[data-testid="sep-aporte-status"]')];
    expect(badges.map((b) => b.textContent?.trim())).toEqual([
      'Pendente',
      'Em processamento',
      'Liquidado',
      'Falhou',
    ]);
    // O tom acompanha o rotulo, mas o texto sozinho ja identifica o estado.
    expect(badges.map((b) => b.getAttribute('data-tone'))).toEqual([
      'neutral',
      'info',
      'success',
      'danger',
    ]);
  });

  it('lista vazia e estado valido e distinto de indisponivel', async () => {
    const el = await renderOperacao(operacao(), pixFixture(), []);
    expect(el.querySelector('[data-testid="sep-operacao-detalhe-aportes-vazio"]')).not.toBeNull();
    expect(
      el.querySelector('[data-testid="sep-operacao-detalhe-aportes-indisponivel"]'),
    ).toBeNull();
    expect(el.querySelector('[data-testid="sep-operacao-detalhe-aportes-erro"]')).toBeNull();
  });

  it('404 dos aportes vira ausencia neutra, sem ecoar o id da operacao', async () => {
    const el = await renderOperacao(operacao(), pixFixture(), 404);
    const nota = el.querySelector('[data-testid="sep-operacao-detalhe-aportes-indisponivel"]');
    expect(nota).not.toBeNull();
    expect(nota?.textContent).not.toContain(ID);
    expect(el.querySelector('[data-testid="sep-operacao-detalhe-aportes-erro"]')).toBeNull();
    expect(fixture.componentInstance.aportesIndisponiveis()).toBe(true);
  });

  it('rede/5xx dos aportes nao derruba o detalhe ja carregado e permite retry', async () => {
    const el = await renderOperacao(operacao(), pixFixture(), 500);
    expect(el.querySelector('[data-testid="sep-operacao-detalhe-aportes-erro"]')).not.toBeNull();
    // Detalhe e status Pix seguem intactos.
    expect(el.querySelector('[data-testid="sep-operacao-detalhe-valor"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="sep-pix-status-publico"]')).not.toBeNull();
    expect(fixture.componentInstance.erro()).toBeNull();

    const p = fixture.componentInstance.consultarAportes();
    httpMock.expectOne(APORTES_URL).flush([aporte('LIQUIDADO')]);
    await p;
    const el2 = await render();
    expect(el2.querySelector('[data-testid="sep-aporte-status"]')?.textContent).toContain(
      'Liquidado',
    );
    expect(el2.querySelector('[data-testid="sep-operacao-detalhe-aportes-erro"]')).toBeNull();
  });

  it('retry com 5xx apos um 404 mostra o erro tecnico, nao a ausencia neutra', async () => {
    await renderOperacao(operacao(), pixFixture(), 404);
    expect(fixture.componentInstance.aportesIndisponiveis()).toBe(true);

    const p = fixture.componentInstance.consultarAportes();
    httpMock.expectOne(APORTES_URL).flush({ message: 'x' }, { status: 500, statusText: 'Error' });
    await p;
    const el = await render();
    expect(fixture.componentInstance.aportesIndisponiveis()).toBe(false);
    expect(el.querySelector('[data-testid="sep-operacao-detalhe-aportes-erro"]')).not.toBeNull();
  });

  it('atualizar aportes fica bloqueado durante a request, evitando duas em voo', async () => {
    const el = await renderOperacao();
    const seletor = '[data-testid="sep-operacao-detalhe-aportes-atualizar"]';
    expect(el.querySelector(seletor)?.textContent).toContain('Atualizar aportes');
    expect(fixture.componentInstance.carregandoAportes()).toBe(false);

    const p = fixture.componentInstance.consultarAportes();
    const elCarregando = await render();
    // `[disabled]` do ion-button e propriedade do web component, nao atributo: verifica o estado
    // que alimenta o binding e o rotulo que o usuario ve.
    expect(fixture.componentInstance.carregandoAportes()).toBe(true);
    expect(elCarregando.querySelector<HTMLIonButtonElement>(seletor)?.disabled).toBe(true);
    expect(elCarregando.querySelector(seletor)?.textContent).toContain('Atualizando...');

    httpMock.expectOne(APORTES_URL).flush([aporte()]);
    await p;
    expect(fixture.componentInstance.carregandoAportes()).toBe(false);
  });

  it('nao oferece nenhum CTA de mutacao de aporte a persona credora', async () => {
    const el = await renderOperacao();
    const card = el.querySelector('[data-testid="sep-operacao-detalhe-aportes"]');
    const texto = (card?.textContent ?? '').toLowerCase();
    expect(texto).not.toContain('registrar');
    expect(texto).not.toContain('novo aporte');
    expect(texto).not.toContain('matching');
    expect(texto).not.toContain('confirmar');
    // O unico botao do card e a releitura.
    const botoes = card?.querySelectorAll('ion-button') ?? [];
    expect(botoes).toHaveLength(1);
    expect(botoes[0].getAttribute('data-testid')).toBe('sep-operacao-detalhe-aportes-atualizar');
  });

  it('o card de aportes nao expoe escrow, provider, idempotency key nem IDs internos', async () => {
    const el = await renderOperacao();
    const card = el.querySelector('[data-testid="sep-operacao-detalhe-aportes"]');
    const html = (card?.innerHTML ?? '').toLowerCase();
    expect(html).not.toContain('escrow');
    expect(html).not.toContain('provider');
    expect(html).not.toContain('idempotency');
    expect(html).not.toContain('contrato-secreto');
    expect(html).not.toContain('celcoin');
  });
});
