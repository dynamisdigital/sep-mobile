import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from '../auth/auth.service';
import { NotificacoesNaoLidasStore } from './notificacoes-nao-lidas.store';

const CONTAGEM = 'http://localhost:8080/api/v1/notificacoes/nao-lidas/contagem';

describe('NotificacoesNaoLidasStore', () => {
  let store: NotificacoesNaoLidasStore;
  let httpMock: HttpTestingController;
  let auth: { currentUser: ReturnType<typeof signal<{ id: string } | null>> };

  beforeEach(() => {
    auth = { currentUser: signal<{ id: string } | null>({ id: 'A' }) };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: auth },
      ],
    });
    store = TestBed.inject(NotificacoesNaoLidasStore);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    vi.useRealTimers();
    httpMock.verify();
  });

  // Sessao encerrada: `clearSession` zera o usuario, e o effect do store precisa rodar.
  function encerrarSessao(): void {
    auth.currentUser.set(null);
    TestBed.tick();
  }

  async function conhecer(naoLidas: number): Promise<void> {
    const promise = store.carregar();
    httpMock.expectOne(CONTAGEM).flush({ naoLidas });
    await promise;
  }

  it('sem usuario autenticado nao consulta e nao expoe contagem', async () => {
    encerrarSessao();
    await store.carregar();
    httpMock.expectNone(CONTAGEM);
    expect(store.contagem()).toBeNull();
  });

  it('expoe carregando enquanto a primeira consulta esta em voo, e a contagem conhecida depois', async () => {
    const promise = store.carregar();
    expect(store.contagem()).toEqual({ situacao: 'carregando' });

    httpMock.expectOne(CONTAGEM).flush({ naoLidas: 3 });
    await promise;

    expect(store.contagem()).toEqual({ situacao: 'conhecida', naoLidas: 3 });
  });

  it('zero e contagem conhecida, distinta de indisponivel', async () => {
    const promise = store.carregar();
    httpMock.expectOne(CONTAGEM).flush({ naoLidas: 0 });
    await promise;

    expect(store.contagem()).toEqual({ situacao: 'conhecida', naoLidas: 0 });
  });

  it('falha sem valor conhecido vira indisponivel, nunca zero', async () => {
    const promise = store.carregar();
    httpMock.expectOne(CONTAGEM).flush(null, { status: 503, statusText: 'Service Unavailable' });
    await promise;

    expect(store.contagem()).toEqual({ situacao: 'indisponivel' });
  });

  for (const [descricao, corpo] of [
    ['corpo nulo', null],
    ['naoLidas ausente', {}],
    ['naoLidas em texto', { naoLidas: '3' }],
    ['naoLidas negativo', { naoLidas: -1 }],
    ['naoLidas fracionario', { naoLidas: 2.5 }],
  ] as const) {
    it(`corpo fora do contrato (${descricao}) vira indisponivel, nao contagem`, async () => {
      const promise = store.carregar();
      httpMock.expectOne(CONTAGEM).flush(corpo);
      await promise;

      expect(store.contagem()).toEqual({ situacao: 'indisponivel' });
    });
  }

  it('reconsulta mantem o numero conhecido enquanto esta em voo e aplica o novo ao chegar', async () => {
    const primeira = store.carregar();
    httpMock.expectOne(CONTAGEM).flush({ naoLidas: 3 });
    await primeira;

    const segunda = store.carregar();
    expect(store.contagem()).toEqual({ situacao: 'conhecida', naoLidas: 3 });
    httpMock.expectOne(CONTAGEM).flush({ naoLidas: 1 });
    await segunda;

    expect(store.contagem()).toEqual({ situacao: 'conhecida', naoLidas: 1 });
  });

  it('reconsulta que falha nao apaga o numero ja conhecido, so o marca como desatualizado', async () => {
    const primeira = store.carregar();
    httpMock.expectOne(CONTAGEM).flush({ naoLidas: 3 });
    await primeira;

    const segunda = store.carregar();
    httpMock.expectOne(CONTAGEM).flush(null, { status: 500, statusText: 'Server Error' });
    await segunda;

    expect(store.contagem()).toEqual({ situacao: 'desatualizada', naoLidas: 3 });
  });

  it('contagem desatualizada volta a conhecida na proxima reconsulta que responde', async () => {
    await conhecer(3);
    const falha = store.carregar();
    httpMock.expectOne(CONTAGEM).flush(null, { status: 500, statusText: 'Server Error' });
    await falha;

    const recuperacao = store.carregar();
    httpMock.expectOne(CONTAGEM).flush({ naoLidas: 2 });
    await recuperacao;

    expect(store.contagem()).toEqual({ situacao: 'conhecida', naoLidas: 2 });
  });

  // Cada pagina cacheada pelo ion-router-outlet tem o proprio header, e shell e central pedem na
  // mesma abertura: sem deduplicacao seriam N requisicoes pelo mesmo numero.
  it('chamadas concorrentes do mesmo usuario compartilham uma unica requisicao', async () => {
    const a = store.carregar();
    const b = store.carregar();
    const c = store.carregar();
    httpMock.expectOne(CONTAGEM).flush({ naoLidas: 2 });
    await Promise.all([a, b, c]);

    expect(store.contagem()).toEqual({ situacao: 'conhecida', naoLidas: 2 });
  });

  it('consulta concluida libera a proxima: carregar de novo faz nova requisicao', async () => {
    const primeira = store.carregar();
    httpMock.expectOne(CONTAGEM).flush({ naoLidas: 2 });
    await primeira;

    const segunda = store.carregar();
    httpMock.expectOne(CONTAGEM).flush({ naoLidas: 2 });
    await segunda;
  });

  it('nao faz polling: depois de responder, o tempo passar nao gera nova consulta', async () => {
    vi.useFakeTimers();
    const promise = store.carregar();
    httpMock.expectOne(CONTAGEM).flush({ naoLidas: 2 });
    await promise;

    await vi.advanceTimersByTimeAsync(30 * 60 * 1000);

    httpMock.expectNone(CONTAGEM);
  });

  describe('leitura confirmada', () => {
    it('baixa o contador na hora, antes da reconsulta responder, e reconcilia com ela', async () => {
      await conhecer(3);

      store.leituraEnviada('x');
      const reconsulta = store.registrarLeitura('x');

      expect(store.contagem()).toEqual({ situacao: 'conhecida', naoLidas: 2 });
      httpMock.expectOne(CONTAGEM).flush({ naoLidas: 2 });
      await reconsulta;
      expect(store.contagem()).toEqual({ situacao: 'conhecida', naoLidas: 2 });
    });

    it('nunca fica negativo', async () => {
      await conhecer(0);

      store.leituraEnviada('x');
      const reconsulta = store.registrarLeitura('x');

      expect(store.contagem()).toEqual({ situacao: 'conhecida', naoLidas: 0 });
      httpMock.expectOne(CONTAGEM).flush({ naoLidas: 0 });
      await reconsulta;
    });

    it('contagem desconhecida nao ganha numero fabricado: so a reconsulta decide', async () => {
      const inicial = store.carregar();
      httpMock.expectOne(CONTAGEM).flush(null, { status: 503, statusText: 'Service Unavailable' });
      await inicial;

      store.leituraEnviada('x');
      const reconsulta = store.registrarLeitura('x');

      expect(store.contagem()).toEqual({ situacao: 'indisponivel' });
      httpMock.expectOne(CONTAGEM).flush({ naoLidas: 4 });
      await reconsulta;
      expect(store.contagem()).toEqual({ situacao: 'conhecida', naoLidas: 4 });
    });

    it('contagem pedida antes da confirmacao e descartada, e nao desfaz a baixa', async () => {
      await conhecer(3);
      const antiga = store.carregar();
      const pendenteAntiga = httpMock.expectOne(CONTAGEM);

      store.leituraEnviada('x');
      const reconsulta = store.registrarLeitura('x');
      const pendenteNova = httpMock.expectOne(CONTAGEM);

      pendenteAntiga.flush({ naoLidas: 3 });
      await antiga;
      expect(store.contagem()).toEqual({ situacao: 'conhecida', naoLidas: 2 });

      pendenteNova.flush({ naoLidas: 2 });
      await reconsulta;
      expect(store.contagem()).toEqual({ situacao: 'conhecida', naoLidas: 2 });
    });

    it('leitura sobre contagem desatualizada tambem baixa na hora', async () => {
      await conhecer(3);
      const falha = store.carregar();
      httpMock.expectOne(CONTAGEM).flush(null, { status: 503, statusText: 'Service Unavailable' });
      await falha;

      store.leituraEnviada('x');
      const reconsulta = store.registrarLeitura('x');

      expect(store.contagem()).toEqual({ situacao: 'desatualizada', naoLidas: 2 });
      httpMock.expectOne(CONTAGEM).flush({ naoLidas: 2 });
      await reconsulta;
      expect(store.contagem()).toEqual({ situacao: 'conhecida', naoLidas: 2 });
    });

    it('reconsulta que falha depois da leitura mantem a baixa e marca desatualizado', async () => {
      await conhecer(3);

      store.leituraEnviada('x');
      const reconsulta = store.registrarLeitura('x');
      httpMock.expectOne(CONTAGEM).flush(null, { status: 500, statusText: 'Server Error' });
      await reconsulta;

      expect(store.contagem()).toEqual({ situacao: 'desatualizada', naoLidas: 2 });
    });

    it('a mesma leitura confirmada duas vezes baixa uma vez so', async () => {
      await conhecer(3);

      store.leituraEnviada('x');
      const primeira = store.registrarLeitura('x');
      const segunda = store.registrarLeitura('x');

      expect(store.contagem()).toEqual({ situacao: 'conhecida', naoLidas: 2 });
      // Cada confirmacao reconsulta; a da primeira foi invalidada pela segunda e sua resposta e ignorada.
      const [invalidada, vigente] = httpMock.match(CONTAGEM);
      vigente.flush({ naoLidas: 2 });
      invalidada.flush({ naoLidas: 3 });
      await Promise.all([primeira, segunda]);
      expect(store.contagem()).toEqual({ situacao: 'conhecida', naoLidas: 2 });
    });

    // O defeito que a F-Sprint 27 so achou no review humano, depois de 59 mutacoes verdes: a
    // recontagem pedida pela primeira confirmacao ja inclui a segunda leitura, e descontar a segunda
    // de novo zerava o contador com aviso nao lido assim que a reconsulta seguinte falhasse.
    it('duas leituras concorrentes com recontagem nao descontam duas vezes', async () => {
      await conhecer(3);
      store.leituraEnviada('x');
      store.leituraEnviada('y');

      const aposX = store.registrarLeitura('x');
      expect(store.contagem()).toEqual({ situacao: 'conhecida', naoLidas: 2 });
      // O servidor ja gravou as duas quando responde a recontagem pedida pela primeira.
      httpMock.expectOne(CONTAGEM).flush({ naoLidas: 1 });
      await aposX;

      const aposY = store.registrarLeitura('y');
      expect(store.contagem()).toEqual({ situacao: 'conhecida', naoLidas: 1 });
      httpMock.expectOne(CONTAGEM).flush(null, { status: 503, statusText: 'Service Unavailable' });
      await aposY;

      expect(store.contagem()).toEqual({ situacao: 'desatualizada', naoLidas: 1 });
    });

    // Timeout depois que o servidor gravou: uma contagem chegou entre o primeiro envio e o retry e ja
    // reflete a leitura. O retry nao pode renovar o marco, senao descontaria de novo.
    it('retry apos timeout que gravou nao desconta de novo', async () => {
      await conhecer(3);
      store.leituraEnviada('x');
      // POST caiu por timeout; entrar na central reconsulta e o servidor ja conta a leitura.
      await conhecer(2);

      store.leituraEnviada('x');
      const reconsulta = store.registrarLeitura('x');

      expect(store.contagem()).toEqual({ situacao: 'conhecida', naoLidas: 2 });
      httpMock.expectOne(CONTAGEM).flush({ naoLidas: 2 });
      await reconsulta;
    });

    it('leitura confirmada sem usuario autenticado nao consulta nem mexe no contador', async () => {
      await conhecer(3);
      store.leituraEnviada('x');
      encerrarSessao();

      await store.registrarLeitura('x');

      httpMock.expectNone(CONTAGEM);
      expect(store.contagem()).toBeNull();
    });

    // Comportamento, nao guarda especifica: o marco so avanca, entao a entrada de antes do logout nao
    // casa com a contagem da sessao nova (o `clear()` do descarte e higiene de memoria).
    it('leitura enviada antes do logout nao autoriza baixa depois de relogar', async () => {
      store.leituraEnviada('x');
      encerrarSessao();
      auth.currentUser.set({ id: 'A' });
      TestBed.tick();
      await conhecer(3);
      await conhecer(3);

      const reconsulta = store.registrarLeitura('x');

      expect(store.contagem()).toEqual({ situacao: 'conhecida', naoLidas: 3 });
      httpMock.expectOne(CONTAGEM).flush({ naoLidas: 3 });
      await reconsulta;
    });
  });

  describe('isolamento de sessao', () => {
    it('logout apaga a contagem na hora', async () => {
      const promise = store.carregar();
      httpMock.expectOne(CONTAGEM).flush({ naoLidas: 4 });
      await promise;

      encerrarSessao();

      expect(store.contagem()).toBeNull();
    });

    it('resposta que chega depois do logout nao e aplicada nem ao relogar o mesmo usuario', async () => {
      const promise = store.carregar();
      const pendente = httpMock.expectOne(CONTAGEM);

      encerrarSessao();
      auth.currentUser.set({ id: 'A' });
      TestBed.tick();
      pendente.flush({ naoLidas: 9 });
      await promise;

      expect(store.contagem()).toBeNull();
    });

    it('relogar o mesmo usuario nao herda o numero da sessao anterior', async () => {
      const primeira = store.carregar();
      httpMock.expectOne(CONTAGEM).flush({ naoLidas: 4 });
      await primeira;

      encerrarSessao();
      auth.currentUser.set({ id: 'A' });
      TestBed.tick();
      const segunda = store.carregar();

      expect(store.contagem()).toEqual({ situacao: 'carregando' });
      httpMock.expectOne(CONTAGEM).flush({ naoLidas: 1 });
      await segunda;
      expect(store.contagem()).toEqual({ situacao: 'conhecida', naoLidas: 1 });
    });

    it('resposta tardia de A nao aparece para B nem sobrescreve a consulta de B', async () => {
      const deA = store.carregar();
      const pendenteDeA = httpMock.expectOne(CONTAGEM);

      encerrarSessao();
      auth.currentUser.set({ id: 'B' });
      TestBed.tick();
      const deB = store.carregar();
      const pendenteDeB = httpMock.expectOne(CONTAGEM);

      pendenteDeB.flush({ naoLidas: 0 });
      await deB;
      pendenteDeA.flush({ naoLidas: 7 });
      await deA;

      expect(store.contagem()).toEqual({ situacao: 'conhecida', naoLidas: 0 });
    });

    it('falha tardia de A nao marca indisponivel a consulta de B ainda em voo', async () => {
      const deA = store.carregar();
      const pendenteDeA = httpMock.expectOne(CONTAGEM);

      encerrarSessao();
      auth.currentUser.set({ id: 'B' });
      TestBed.tick();
      const deB = store.carregar();
      const pendenteDeB = httpMock.expectOne(CONTAGEM);

      pendenteDeA.flush(null, { status: 503, statusText: 'Service Unavailable' });
      await deA;
      expect(store.contagem()).toEqual({ situacao: 'carregando' });

      pendenteDeB.flush({ naoLidas: 2 });
      await deB;
      expect(store.contagem()).toEqual({ situacao: 'conhecida', naoLidas: 2 });
    });

    // Troca de conta sem passar por `null` (ex.: um login novo aplicado por cima da sessao): a
    // consulta de A em voo nao pode ser reaproveitada para B, e B nao ve o numero de A.
    it('troca direta de A para B nao reaproveita a consulta de A', async () => {
      const deA = store.carregar();
      const pendenteDeA = httpMock.expectOne(CONTAGEM);

      auth.currentUser.set({ id: 'B' });
      TestBed.tick();
      expect(store.contagem()).toBeNull();
      const deB = store.carregar();
      const pendenteDeB = httpMock.expectOne(CONTAGEM);

      pendenteDeA.flush({ naoLidas: 7 });
      await deA;
      expect(store.contagem()).toEqual({ situacao: 'carregando' });

      pendenteDeB.flush({ naoLidas: 1 });
      await deB;
      expect(store.contagem()).toEqual({ situacao: 'conhecida', naoLidas: 1 });
    });
  });
});
