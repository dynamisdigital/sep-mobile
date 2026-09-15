import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';

import {
  NotificacaoResponse,
  PageResponse,
  UsuarioResponse,
  UsuarioRole,
} from '../../../core/api/api.models';
import { AuthService } from '../../../core/auth/auth.service';
import { NotificacoesMobileService } from '../../../core/notificacoes/notificacoes-mobile.service';
import { NotificacoesNaoLidasStore } from '../../../core/notificacoes/notificacoes-nao-lidas.store';
import { NotificacoesComponent } from './notificacoes.component';

const CONTRATO_ID = '1f0a8c2e-7d3b-6e10-9a4f-2b7c5d8e9f01';

// Horarios ao meio-dia UTC: a data exibida e a mesma em UTC (CI) e em America/Sao_Paulo (dev).
const CRIADA_EM = '2026-09-14T15:00:00.123456Z';
const LIDA_EM = '2026-09-15T15:30:00.654321Z';

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (valor: T) => void;
  reject: (erro: unknown) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (valor: T) => void;
  let reject!: (erro: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function usuario(role: UsuarioRole = 'CLIENTE'): UsuarioResponse {
  return {
    id: '1f0799c0-98b9-6d9d-bc4a-7d6f5b771001',
    username: 'cliente@empresa.com',
    role,
    dataCriacao: '2026-04-24T18:30:00-03:00',
    dataModificacao: '2026-04-24T18:30:00-03:00',
    criadoPor: 'system',
    modificadoPor: 'system',
    precisaRedefinirSenha: false,
    mfaHabilitado: false,
  };
}

function notificacao(parcial: Partial<NotificacaoResponse> = {}): NotificacaoResponse {
  return {
    id: '1f0a8c2e-7d3b-6e10-9a4f-2b7c5d8e9f00',
    tipo: 'DESEMBOLSO_PIX_CONCLUIDO',
    titulo: 'Desembolso concluido',
    mensagem: 'A transferencia Pix do desembolso do seu contrato foi concluida.',
    criadaEm: CRIADA_EM,
    lidaEm: null,
    referencia: { tipo: 'CONTRATO', id: CONTRATO_ID },
    ...parcial,
  };
}

function pagina(
  content: NotificacaoResponse[],
  totalElements = content.length,
  number = 0,
): PageResponse<NotificacaoResponse> {
  return {
    content,
    totalElements,
    totalPages: Math.ceil(totalElements / 10),
    number,
    size: 10,
    first: number === 0,
    last: (number + 1) * 10 >= totalElements,
    numberOfElements: content.length,
    empty: content.length === 0,
  };
}

function erroHttp(status: number, corpo: unknown): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: corpo, statusText: 'Erro' });
}

// A busca e disparada sem await (hook do Ionic): esvaziar as microtasks antes de renderizar.
async function assentar(fixture: ComponentFixture<NotificacoesComponent>): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  fixture.detectChanges();
}

function setup(opts: { listar?: ReturnType<typeof vi.fn>; role?: UsuarioRole } = {}) {
  const listar = opts.listar ?? vi.fn().mockResolvedValue(pagina([notificacao()]));
  const carregar = vi.fn().mockResolvedValue(undefined);
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      {
        provide: AuthService,
        useValue: { currentUser: signal(usuario(opts.role)), logout: vi.fn() },
      },
      { provide: NotificacoesMobileService, useValue: { listar } },
      { provide: NotificacoesNaoLidasStore, useValue: { contagem: signal(null), carregar } },
    ],
  });
  const navSpy = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  const fixture = TestBed.createComponent(NotificacoesComponent);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const porTestId = (id: string) => el.querySelector<HTMLElement>(`[data-testid="${id}"]`);
  const todosPorTestId = (id: string) =>
    Array.from(el.querySelectorAll<HTMLElement>(`[data-testid="${id}"]`));
  const texto = (id: string) => porTestId(id)?.textContent?.replace(/\s+/g, ' ').trim();
  const clicar = async (id: string) => {
    porTestId(id)?.click();
    await assentar(fixture);
  };
  const entrar = async () => {
    fixture.componentInstance.ionViewWillEnter();
    await assentar(fixture);
  };
  return {
    fixture,
    el,
    listar,
    carregar,
    navSpy,
    porTestId,
    todosPorTestId,
    texto,
    clicar,
    entrar,
  };
}

describe('NotificacoesComponent', () => {
  describe('entrada', () => {
    it('consulta a primeira pagina com tamanho 10 e pede a contagem ao store', async () => {
      const { listar, carregar, entrar } = setup();
      await entrar();
      expect(listar).toHaveBeenCalledExactlyOnceWith(0, 10);
      expect(carregar).toHaveBeenCalledTimes(1);
    });

    it('reentrada pela pilha do Ionic reconsulta lista e contagem', async () => {
      const { listar, carregar, entrar } = setup();
      await entrar();
      await entrar();
      expect(listar).toHaveBeenCalledTimes(2);
      expect(carregar).toHaveBeenCalledTimes(2);
    });

    it('move o foco para o titulo h1 ao entrar', async () => {
      const { fixture, porTestId, entrar } = setup();
      await entrar();
      fixture.componentInstance.ionViewDidEnter();
      const titulo = porTestId('sep-notificacoes-titulo');
      expect(titulo?.tagName).toBe('H1');
      // Comparacao booleana: um toBe entre elementos, se falhar, serializa a arvore do Ionic e estoura
      // a memoria do worker em vez de reprovar.
      expect(document.activeElement === titulo).toBe(true);
    });

    // O ion-content ja e o landmark main; um <main> dentro dele repetiria o defeito que a M-17 corrigiu.
    it('nao aninha <main> dentro do ion-content', async () => {
      const { el, entrar } = setup();
      await entrar();
      expect(el.querySelector('main')).toBeNull();
    });
  });

  describe('quatro superficies', () => {
    it('carregando enquanto a consulta esta em voo, sem lista, vazio nem erro', async () => {
      const emVoo = deferred<PageResponse<NotificacaoResponse>>();
      const { porTestId, entrar } = setup({ listar: vi.fn().mockReturnValue(emVoo.promise) });
      await entrar();

      expect(porTestId('sep-notificacoes-carregando')).not.toBeNull();
      expect(porTestId('sep-notificacoes-vazio')).toBeNull();
      expect(porTestId('sep-notificacoes-erro')).toBeNull();
      expect(porTestId('sep-notificacoes-item')).toBeNull();
    });

    it('lista na ordem do servidor com rotulo textual de lida e nao lida', async () => {
      const { todosPorTestId, texto, entrar } = setup({
        listar: vi
          .fn()
          .mockResolvedValue(
            pagina([
              notificacao({ id: 'n-2', titulo: 'Mais recente', lidaEm: null }),
              notificacao({ id: 'n-1', titulo: 'Mais antiga', lidaEm: LIDA_EM }),
            ]),
          ),
      });
      await entrar();

      const itens = todosPorTestId('sep-notificacoes-item');
      expect(itens.map((item) => item.querySelector('h2')?.textContent?.trim())).toEqual([
        'Mais recente',
        'Mais antiga',
      ]);
      const situacoes = todosPorTestId('sep-notificacoes-item-situacao').map((s) =>
        s.textContent?.replace(/\s+/g, ' ').trim(),
      );
      expect(situacoes[0]).toBe('Nao lida');
      expect(situacoes[1]).toMatch(/^Lida em 15\/09\/2026/);
      expect(itens[0].textContent).toContain('Recebida em 14/09/2026');
      expect(texto('sep-notificacoes-total')).toBe('2 notificacoes');
    });

    // Caso comum, nao de borda: quem so atua como credora nao tem gatilho ativo e ve a central assim.
    it('200 com content vazio mostra o vazio, nao erro nem retry', async () => {
      const { porTestId, texto, entrar } = setup({
        listar: vi.fn().mockResolvedValue(pagina([])),
      });
      await entrar();

      expect(texto('sep-notificacoes-vazio')).toContain('Voce nao tem notificacoes.');
      expect(porTestId('sep-notificacoes-erro')).toBeNull();
      expect(porTestId('sep-notificacoes-retry')).toBeNull();
      expect(porTestId('sep-notificacoes-item')).toBeNull();
    });

    for (const [descricao, corpo] of [
      ['corpo nulo', null],
      ['sem content', { totalElements: 0 }],
      ['content que nao e lista', { content: {}, totalElements: 0 }],
      ['totalElements em texto', { content: [], totalElements: '0' }],
    ] as const) {
      it(`pagina fora do contrato (${descricao}) e erro, nao vazio`, async () => {
        const { porTestId, entrar } = setup({ listar: vi.fn().mockResolvedValue(corpo) });
        await entrar();

        expect(porTestId('sep-notificacoes-erro')).not.toBeNull();
        expect(porTestId('sep-notificacoes-vazio')).toBeNull();
      });
    }

    it('erro tecnico sem corpo mostra mensagem padrao e retry que recupera a lista', async () => {
      const listar = vi
        .fn()
        .mockRejectedValueOnce(erroHttp(503, null))
        .mockResolvedValueOnce(pagina([notificacao()]));
      const { porTestId, texto, clicar, entrar } = setup({ listar });
      await entrar();

      expect(texto('sep-notificacoes-erro')).toContain(
        'Nao foi possivel carregar suas notificacoes. Tente novamente.',
      );
      await clicar('sep-notificacoes-retry');

      expect(listar).toHaveBeenCalledTimes(2);
      expect(porTestId('sep-notificacoes-erro')).toBeNull();
      expect(porTestId('sep-notificacoes-item')).not.toBeNull();
    });
  });

  describe('texto de erro vindo do corpo (helper mensagemDaApi)', () => {
    it('usa a message do backend quando e texto utilizavel', async () => {
      const corpo = { status: 500, message: 'Erro interno. Código de suporte: abc-123.' };
      const { texto, entrar } = setup({ listar: vi.fn().mockRejectedValue(erroHttp(500, corpo)) });
      await entrar();
      expect(texto('sep-notificacoes-erro')).toContain('Erro interno. Código de suporte: abc-123.');
    });

    for (const [descricao, corpo] of [
      ['corpo HTML de proxy', '<h1>502 Bad Gateway</h1>'],
      ['message numerica', { message: 5 }],
      ['message em branco', { message: '   ' }],
    ] as const) {
      it(`${descricao} cai na mensagem padrao, sem renderizar o corpo`, async () => {
        const { porTestId, texto, entrar } = setup({
          listar: vi.fn().mockRejectedValue(erroHttp(502, corpo)),
        });
        await entrar();

        expect(texto('sep-notificacoes-erro')).toBe(
          'Nao foi possivel carregar suas notificacoes. Tente novamente. Tentar novamente',
        );
        expect(porTestId('sep-notificacoes-erro')?.querySelector('h1')).toBeNull();
      });
    }
  });

  it('texto do servidor e renderizado como texto, nunca como HTML', async () => {
    const { el, entrar } = setup({
      listar: vi
        .fn()
        .mockResolvedValue(pagina([notificacao({ titulo: '<img src=x onerror="alert(1)">' })])),
    });
    await entrar();

    expect(el.querySelector('.sep-notificacoes-lista img')).toBeNull();
    expect(el.querySelector('h2')?.textContent).toContain('<img src=x onerror="alert(1)">');
  });

  it('data que nao e ISO mostra o texto recebido em vez de derrubar a lista', async () => {
    const { todosPorTestId, entrar } = setup({
      listar: vi.fn().mockResolvedValue(pagina([notificacao({ lidaEm: 'ontem' })])),
    });
    await entrar();

    expect(todosPorTestId('sep-notificacoes-item-situacao')[0].textContent).toContain(
      'Lida em ontem',
    );
  });

  describe('paginacao', () => {
    const dezItens = (prefixo: string) =>
      Array.from({ length: 10 }, (_, i) => notificacao({ id: `${prefixo}-${i}`, titulo: prefixo }));

    it('usa totalElements do servidor e avanca de pagina anunciando e focando o titulo', async () => {
      const listar = vi
        .fn()
        .mockResolvedValueOnce(pagina(dezItens('p1'), 25, 0))
        .mockResolvedValueOnce(pagina(dezItens('p2'), 25, 1));
      const { porTestId, texto, clicar, entrar } = setup({ listar });
      await entrar();

      expect(texto('sep-notificacoes-pagina-atual')).toBe('Pagina 1 de 3');
      expect((porTestId('sep-notificacoes-anterior') as HTMLButtonElement).disabled).toBe(true);

      await clicar('sep-notificacoes-proxima');

      expect(listar).toHaveBeenLastCalledWith(1, 10);
      expect(texto('sep-notificacoes-pagina-atual')).toBe('Pagina 2 de 3');
      expect(texto('sep-notificacoes-anuncio')).toBe('Pagina 2 de 3');
      expect(document.activeElement === porTestId('sep-notificacoes-titulo')).toBe(true);
    });

    it('resposta tardia da pagina anterior nao sobrescreve a pagina pedida por ultimo', async () => {
      const primeira = deferred<PageResponse<NotificacaoResponse>>();
      const segunda = deferred<PageResponse<NotificacaoResponse>>();
      const listar = vi
        .fn()
        .mockReturnValueOnce(primeira.promise)
        .mockReturnValueOnce(segunda.promise);
      const { fixture, todosPorTestId, entrar } = setup({ listar });
      await entrar();

      const irParaSegunda = fixture.componentInstance.irParaPagina(1);
      segunda.resolve(pagina(dezItens('p2'), 25, 1));
      await irParaSegunda;
      primeira.resolve(pagina(dezItens('p1'), 25, 0));
      await assentar(fixture);

      const titulos = todosPorTestId('sep-notificacoes-item').map((i) =>
        i.querySelector('h2')?.textContent?.trim(),
      );
      expect(new Set(titulos)).toEqual(new Set(['p2']));
    });

    it('falha tardia de uma consulta substituida nao troca a lista por erro', async () => {
      const primeira = deferred<PageResponse<NotificacaoResponse>>();
      const listar = vi
        .fn()
        .mockReturnValueOnce(primeira.promise)
        .mockResolvedValueOnce(pagina([notificacao()]));
      const { fixture, porTestId, entrar } = setup({ listar });
      await entrar();

      await fixture.componentInstance.tentarNovamente();
      primeira.reject(erroHttp(503, null));
      await assentar(fixture);

      expect(porTestId('sep-notificacoes-erro')).toBeNull();
      expect(porTestId('sep-notificacoes-item')).not.toBeNull();
    });

    it('pagina alem do fim com total > 0 oferece a ultima pagina valida, sem pular sozinha', async () => {
      const listar = vi
        .fn()
        .mockResolvedValueOnce(pagina([], 25, 5))
        .mockResolvedValueOnce(pagina(dezItens('p3').slice(0, 5), 25, 2));
      const { porTestId, texto, clicar, entrar } = setup({ listar });
      await entrar();

      expect(porTestId('sep-notificacoes-vazio')).toBeNull();
      expect(texto('sep-notificacoes-pagina-vazia')).toContain('Esta pagina nao tem notificacoes.');
      expect(listar).toHaveBeenCalledTimes(1);

      expect(texto('sep-notificacoes-ultima-pagina')).toBe('Ir para a pagina 3');
      await clicar('sep-notificacoes-ultima-pagina');
      expect(listar).toHaveBeenLastCalledWith(2, 10);
    });
  });

  describe('referencia por rota interna', () => {
    it('CONTRATO abre o detalhe do contrato pelo id do contrato', async () => {
      const { navSpy, clicar, entrar } = setup();
      await entrar();

      await clicar('sep-notificacoes-item-referencia');

      expect(navSpy).toHaveBeenCalledWith(`/app/formalizacao/contratos/${CONTRATO_ID}`);
    });

    for (const [descricao, parcial] of [
      ['referencia nula', { referencia: null }],
      ['referencia ausente', { referencia: undefined }],
      [
        'tipo desconhecido',
        {
          referencia: {
            tipo: 'PROPOSTA',
            id: CONTRATO_ID,
          } as unknown as NotificacaoResponse['referencia'],
        },
      ],
      ['id com barra', { referencia: { tipo: 'CONTRATO', id: '../../admin' } }],
      ['id com query', { referencia: { tipo: 'CONTRATO', id: 'abc?x=1' } }],
    ] as const) {
      it(`${descricao} mantem o aviso legivel e sem CTA`, async () => {
        const { porTestId, entrar } = setup({
          listar: vi.fn().mockResolvedValue(pagina([notificacao(parcial)])),
        });
        await entrar();

        expect(porTestId('sep-notificacoes-item')?.querySelector('h2')?.textContent).toContain(
          'Desembolso concluido',
        );
        expect(porTestId('sep-notificacoes-item-referencia')).toBeNull();
      });
    }

    it('usuario sem a role da rota do contrato nao recebe CTA que levaria ao access-denied', async () => {
      const { porTestId, entrar } = setup({ role: 'ADMIN' });
      await entrar();
      expect(porTestId('sep-notificacoes-item')).not.toBeNull();
      expect(porTestId('sep-notificacoes-item-referencia')).toBeNull();
    });
  });
});
