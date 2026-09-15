import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild,
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

export interface ItemDaCentral {
  notificacao: NotificacaoResponse;
  // Rota interna montada no app a partir da referencia, ou null quando nao ha destino permitido.
  rota: string | null;
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

  readonly pagina = signal(0);
  readonly consulta = signal<Consulta>({ situacao: 'carregando' });
  // Regiao de status: diz onde o usuario chegou depois de um gesto que substitui o conteudo.
  readonly anuncio = signal('');

  readonly itens = computed<ItemDaCentral[]>(() => {
    const consulta = this.consulta();
    if (consulta.situacao !== 'pronta') {
      return [];
    }
    const role = this.auth.currentUser()?.role;
    return consulta.itens.map((notificacao) => ({
      notificacao,
      rota: rotaDaReferencia(notificacao, role),
    }));
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

  private async buscar(porGesto: boolean): Promise<void> {
    const geracao = ++this.geracao;
    this.anuncio.set('');
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
