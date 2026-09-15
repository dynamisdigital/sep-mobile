import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { Router } from '@angular/router';
import { ViewDidEnter, ViewWillEnter } from '@ionic/angular';
import { IonContent, IonSpinner } from '@ionic/angular/standalone';

import { mensagemDaApi } from '../../../core/api/api-error';
import { NotificacaoResponse, PageResponse, UsuarioRole } from '../../../core/api/api.models';
import { AuthService } from '../../../core/auth/auth.service';
import { NotificacoesMobileService } from '../../../core/notificacoes/notificacoes-mobile.service';
import { NotificacoesNaoLidasStore } from '../../../core/notificacoes/notificacoes-nao-lidas.store';
import { HeaderMobileComponent } from '../../../layout/header-mobile/header-mobile.component';

const TAMANHO_PAGINA = 10;
const ERRO_PADRAO = 'Nao foi possivel carregar suas notificacoes. Tente novamente.';
const ERRO_LEITURA = 'Nao foi possivel marcar o aviso como lido. Tente novamente.';
// Mesmo texto para aviso inexistente, de outra conta ou de e-mail: o 404 do backend e neutro, e a tela
// nao pode ser mais especifica que ele.
const AVISO_NAO_ENCONTRADO =
  'Este aviso nao foi encontrado. Atualize a lista para ver seus avisos.';

// Destino da referencia CONTRATO e as roles que a rota de destino exige
// (`formalizacao/contratos/:contratoId` em authenticated.routes.ts). Sem a role o link levaria o
// usuario ao access-denied, entao o aviso fica sem CTA.
const ROTA_DO_CONTRATO = '/app/formalizacao/contratos';
const ROLES_DA_ROTA_DO_CONTRATO: readonly UsuarioRole[] = ['CLIENTE'];

// O id da referencia vira segmento de rota. Validar antes de usar, como `support-reference.ts` faz
// com o traceId: `/`, `?`, `#` ou `..` vindos do corpo mudariam a rota navegada.
const SEGMENTO_DE_ROTA_SEGURO = /^[A-Za-z0-9-]{1,64}$/;

type Consulta =
  | { situacao: 'carregando' }
  | { situacao: 'erro'; mensagem: string }
  | { situacao: 'pronta'; itens: NotificacaoResponse[]; total: number };

interface FalhaDeLeitura {
  mensagem: string;
  naoEncontrada: boolean;
}

interface ItemDaCentral {
  notificacao: NotificacaoResponse;
  // Rota interna montada no app a partir da referencia, ou null quando nao ha destino permitido.
  rota: string | null;
  marcando: boolean;
  falha: FalhaDeLeitura | null;
}

// Central de notificacoes do usuario autenticado (M-Sprint 19, spec 219). Lista paginada na ordem do
// servidor (`criadaEm` desc, `id` desc) com quatro superficies distintas: carregando, lista, vazio e
// erro tecnico. So o canal IN_APP chega aqui; ownership e recorte sao do backend.
//
// O vazio e o caso comum, nao de borda: o unico gatilho ativo (desembolso Pix concluido) fala com o
// tomador, entao quem so atua como credora ve a central vazia.
@Component({
  selector: 'sep-notificacoes',
  standalone: true,
  imports: [IonContent, IonSpinner, HeaderMobileComponent],
  templateUrl: './notificacoes.component.html',
  styleUrl: './notificacoes.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificacoesComponent implements ViewWillEnter, ViewDidEnter {
  private readonly service = inject(NotificacoesMobileService);
  private readonly naoLidas = inject(NotificacoesNaoLidasStore);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly titulo = viewChild.required<ElementRef<HTMLHeadingElement>>('titulo');
  private readonly titulosDosItens = viewChildren<ElementRef<HTMLHeadingElement>>('tituloDoItem');

  readonly pagina = signal(0);
  readonly consulta = signal<Consulta>({ situacao: 'carregando' });
  // Regiao de status: diz onde o usuario chegou depois de um gesto que substitui o conteudo.
  readonly anuncio = signal('');
  private readonly marcando = signal<ReadonlySet<string>>(new Set());
  private readonly falhasDeLeitura = signal<ReadonlyMap<string, FalhaDeLeitura>>(new Map());
  // Leituras confirmadas pelo servidor, sobrepostas a qualquer lista: uma resposta de lista pedida
  // antes da confirmacao (reentrada, troca de pagina) ainda traz o aviso como nao lido, e nao pode
  // ressuscita-lo. A pagina e cacheada pelo Ionic, entao o mapa sobrevive a reentrada.
  private readonly lidasConfirmadas = signal<ReadonlyMap<string, string>>(new Map());

  readonly itens = computed<ItemDaCentral[]>(() => {
    const consulta = this.consulta();
    if (consulta.situacao !== 'pronta') {
      return [];
    }
    const role = this.auth.currentUser()?.role;
    const confirmadas = this.lidasConfirmadas();
    const marcando = this.marcando();
    const falhas = this.falhasDeLeitura();
    return consulta.itens.map((recebida) => {
      const lidaEmConfirmada = recebida.lidaEm ? undefined : confirmadas.get(recebida.id);
      const notificacao = lidaEmConfirmada ? { ...recebida, lidaEm: lidaEmConfirmada } : recebida;
      return {
        notificacao,
        rota: rotaDaReferencia(notificacao, role),
        marcando: marcando.has(notificacao.id),
        falha: falhas.get(notificacao.id) ?? null,
      };
    });
  });
  readonly total = computed(() => {
    const consulta = this.consulta();
    return consulta.situacao === 'pronta' ? consulta.total : 0;
  });
  readonly totalPaginas = computed(() => Math.ceil(this.total() / TAMANHO_PAGINA));
  readonly mensagemErro = computed(() => {
    const consulta = this.consulta();
    return consulta.situacao === 'erro' ? consulta.mensagem : '';
  });

  protected readonly formatarDataHora = formatarDataHora;

  // Cada busca invalida as anteriores: o `firstValueFrom` do service nao deixa cancelar, entao
  // resposta de pagina ou tentativa anterior que chega depois e descartada aqui.
  private geracao = 0;

  // Dispara na primeira entrada e em toda reentrada pela pilha do Ionic (voltar do contrato, trocar
  // de aba e voltar). E o momento em que a spec manda reconsultar lista e contador; sem polling.
  ionViewWillEnter(): void {
    void this.naoLidas.carregar();
    void this.buscar(false);
  }

  // `ionViewDidEnter`, e nao `ngAfterViewInit`: antes disso os web components do Ionic nao tem caixa
  // de layout e `focus()` e no-op (medido na M-17, `account-locked.component.ts`). O Angular nao move
  // foco na navegacao: sem isto quem chega pelo sino fica com o foco no botao da pagina anterior.
  ionViewDidEnter(): void {
    this.titulo().nativeElement.focus();
  }

  irParaPagina(pagina: number): Promise<void> {
    this.pagina.set(pagina);
    return this.buscar(true);
  }

  tentarNovamente(): Promise<void> {
    return this.buscar(true);
  }

  abrirReferencia(rota: string): void {
    void this.router.navigateByUrl(rota);
  }

  // Gesto explicito por aviso: abrir a central, paginar ou seguir a referencia nao marca nada. Aviso ja
  // lido ou com leitura em voo nao gera outro POST, nem por toque repetido nem por chamada direta. So a
  // confirmacao do servidor baixa o contador; a falha libera o retry com o mesmo id, que o POST
  // idempotente absorve mesmo que a tentativa anterior tenha gravado antes de cair.
  async marcarComoLida(id: string): Promise<void> {
    const item = this.itens().find((i) => i.notificacao.id === id);
    if (!item || item.notificacao.lidaEm || item.marcando) {
      return;
    }
    this.marcando.update((ids) => new Set(ids).add(id));
    this.falhasDeLeitura.update((falhas) => semFalha(falhas, id));
    this.anuncio.set('');
    this.naoLidas.leituraEnviada(id);
    try {
      const lidaEm = lidaEmConfirmada(await this.service.marcarComoLida(id), id);
      if (lidaEm === undefined) {
        this.registrarFalhaDeLeitura(id, { mensagem: ERRO_LEITURA, naoEncontrada: false });
        return;
      }
      this.lidasConfirmadas.update((lidas) => new Map(lidas).set(id, lidaEm));
      void this.naoLidas.registrarLeitura(id);
      this.anuncio.set('Aviso marcado como lido.');
      // O botao some com a leitura: o foco vai ao titulo do aviso em vez de cair no body.
      this.titulosDosItens()
        .find((titulo) => titulo.nativeElement.id === idDoTitulo(id))
        ?.nativeElement.focus();
    } catch (erro) {
      const naoEncontrada = erro instanceof HttpErrorResponse && erro.status === 404;
      this.registrarFalhaDeLeitura(id, {
        mensagem: naoEncontrada ? AVISO_NAO_ENCONTRADO : ERRO_LEITURA,
        naoEncontrada,
      });
    } finally {
      this.marcando.update((ids) => semId(ids, id));
    }
  }

  protected idDoTitulo(id: string): string {
    return idDoTitulo(id);
  }

  private registrarFalhaDeLeitura(id: string, falha: FalhaDeLeitura): void {
    this.falhasDeLeitura.update((falhas) => new Map(falhas).set(id, falha));
  }

  private async buscar(porGesto: boolean): Promise<void> {
    const geracao = ++this.geracao;
    this.anuncio.set('');
    this.falhasDeLeitura.set(new Map());
    this.consulta.set({ situacao: 'carregando' });
    try {
      const corpo: unknown = await this.service.listar(this.pagina(), TAMANHO_PAGINA);
      if (geracao !== this.geracao) {
        return;
      }
      if (ehPaginaValida(corpo)) {
        this.consulta.set({ situacao: 'pronta', itens: corpo.content, total: corpo.totalElements });
        if (porGesto) {
          this.anuncio.set(this.descricaoDaPagina());
        }
      } else {
        this.consulta.set({ situacao: 'erro', mensagem: ERRO_PADRAO });
      }
    } catch (erro) {
      if (geracao !== this.geracao) {
        return;
      }
      this.consulta.set({ situacao: 'erro', mensagem: mensagemDaApi(erro) ?? ERRO_PADRAO });
    }
    // Depois de um gesto o conteudo foi substituido: o foco volta ao titulo em vez de cair no body.
    if (porGesto) {
      this.titulo().nativeElement.focus();
    }
  }

  private descricaoDaPagina(): string {
    if (this.total() === 0) {
      return 'Voce nao tem notificacoes.';
    }
    if (this.itens().length === 0) {
      return 'Esta pagina nao tem notificacoes.';
    }
    return `Pagina ${this.pagina() + 1} de ${this.totalPaginas()}`;
  }
}

// Resposta sem `content` em lista ou sem `totalElements` inteiro e erro, nao central vazia: confundir
// as duas esconderia uma falha atras da superficie mais comum em producao.
function ehPaginaValida(corpo: unknown): corpo is PageResponse<NotificacaoResponse> {
  if (corpo === null || typeof corpo !== 'object') {
    return false;
  }
  const pagina = corpo as Partial<Record<keyof PageResponse<NotificacaoResponse>, unknown>>;
  return (
    Array.isArray(pagina.content) &&
    typeof pagina.totalElements === 'number' &&
    Number.isInteger(pagina.totalElements) &&
    pagina.totalElements >= 0
  );
}

function idDoTitulo(id: string): string {
  return `sep-notificacao-${id}`;
}

// Copias sem o id, para manter os signals imutaveis.
function semId(ids: ReadonlySet<string>, id: string): ReadonlySet<string> {
  const copia = new Set(ids);
  copia.delete(id);
  return copia;
}

function semFalha(
  falhas: ReadonlyMap<string, FalhaDeLeitura>,
  id: string,
): ReadonlyMap<string, FalhaDeLeitura> {
  const copia = new Map(falhas);
  copia.delete(id);
  return copia;
}

// So a confirmacao do servidor marca o aviso como lido, e com o `lidaEm` que ele devolveu (o da
// primeira leitura, se ja estava lido em outro canal). Corpo sem o mesmo id ou sem `lidaEm` nao e
// confirmacao: fica como falha e o retry, idempotente, resolve.
function lidaEmConfirmada(resposta: unknown, id: string): string | undefined {
  if (resposta === null || typeof resposta !== 'object') {
    return undefined;
  }
  const corpo = resposta as Partial<Record<keyof NotificacaoResponse, unknown>>;
  return corpo.id === id && typeof corpo.lidaEm === 'string' && corpo.lidaEm !== ''
    ? corpo.lidaEm
    : undefined;
}

// So CONTRATO tem destino, e so para quem a rota de destino admite. Referencia nula, ausente, de tipo
// desconhecido ou com id fora do formato fica sem CTA: o aviso continua legivel. A navegacao usa rota
// montada aqui, nunca URL vinda do backend; guardas e ownership do destino continuam valendo.
function rotaDaReferencia(
  notificacao: NotificacaoResponse,
  role: UsuarioRole | undefined,
): string | null {
  const referencia = notificacao.referencia;
  if (referencia?.tipo !== 'CONTRATO' || !role || !ROLES_DA_ROTA_DO_CONTRATO.includes(role)) {
    return null;
  }
  return typeof referencia.id === 'string' && SEGMENTO_DE_ROTA_SEGURO.test(referencia.id)
    ? `${ROTA_DO_CONTRATO}/${referencia.id}`
    : null;
}

// `criadaEm`/`lidaEm` chegam com offset e ate microssegundos. Data invalida mostra o texto recebido:
// o `Intl` lancaria RangeError dentro do template e derrubaria a lista inteira.
function formatarDataHora(iso: string): string {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) {
    return iso;
  }
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(data);
}
