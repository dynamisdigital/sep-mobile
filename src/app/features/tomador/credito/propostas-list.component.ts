import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonContent,
  IonRefresher,
  IonRefresherContent,
  IonSelect,
  IonSelectOption,
  IonSpinner,
} from '@ionic/angular/standalone';

import { PropostaResponse, StatusProposta, TipoOperacao } from '../../../core/api/api.models';
import {
  CreditoMobileService,
  ListarPropostasParams,
} from '../../../core/credito/credito-mobile.service';
import { HeaderMobileComponent } from '../../../layout/header-mobile/header-mobile.component';

type FiltroStatus = StatusProposta | 'TODAS';
type VarianteStatus = 'aprovado' | 'reprovado' | 'pendente' | 'andamento';

const PAGE_SIZE = 20;

const ROTULOS_STATUS: Record<StatusProposta, string> = {
  EM_ANALISE: 'Em analise',
  PRE_APROVADA: 'Pre-aprovada',
  PENDENCIA: 'Pendencia',
  APROVADA: 'Aprovada',
  REJEITADA: 'Rejeitada',
};

const ROTULOS_TIPO: Record<TipoOperacao, string> = {
  CAPITAL_GIRO: 'Capital de giro',
  OUTROS: 'Outros',
};

const FILTROS: readonly { value: FiltroStatus; label: string }[] = [
  { value: 'TODAS', label: 'Todas' },
  { value: 'EM_ANALISE', label: 'Em analise' },
  { value: 'PRE_APROVADA', label: 'Pre-aprovada' },
  { value: 'PENDENCIA', label: 'Pendencia' },
  { value: 'APROVADA', label: 'Aprovada' },
  { value: 'REJEITADA', label: 'Rejeitada' },
];

// Lista paginada das propostas do tomador autenticado. Consome GET /credito/propostas via
// CreditoMobileService (CLIENTE ve apenas as proprias; ownership e aplicado no backend). A
// tela apenas apresenta status e valores: nao calcula score, elegibilidade nem transicao.
@Component({
  selector: 'sep-propostas-list',
  standalone: true,
  imports: [
    IonContent,
    IonRefresher,
    IonRefresherContent,
    IonSelect,
    IonSelectOption,
    IonSpinner,
    HeaderMobileComponent,
  ],
  templateUrl: './propostas-list.component.html',
  styleUrl: './propostas-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PropostasListComponent implements OnInit {
  private readonly credito = inject(CreditoMobileService);
  private readonly router = inject(Router);

  protected readonly filtros = FILTROS;

  readonly propostas = signal<PropostaResponse[]>([]);
  readonly carregando = signal(false);
  readonly carregandoMais = signal(false);
  readonly erro = signal<string | null>(null);
  readonly filtroStatus = signal<FiltroStatus>('TODAS');
  readonly ultimaPagina = signal(true);

  private pagina = 0;

  ngOnInit(): void {
    void this.carregar();
  }

  async carregar(): Promise<void> {
    this.carregando.set(true);
    this.erro.set(null);
    this.pagina = 0;
    try {
      const page = await this.credito.listarPropostas(this.params(0));
      this.propostas.set(page.content);
      this.ultimaPagina.set(page.last);
    } catch {
      this.propostas.set([]);
      this.erro.set('Nao foi possivel carregar as propostas. Tente novamente.');
    } finally {
      this.carregando.set(false);
    }
  }

  async carregarMais(): Promise<void> {
    if (this.carregandoMais() || this.ultimaPagina()) {
      return;
    }
    this.carregandoMais.set(true);
    this.erro.set(null);
    try {
      const proxima = this.pagina + 1;
      const page = await this.credito.listarPropostas(this.params(proxima));
      this.pagina = proxima;
      this.propostas.update((atual) => [...atual, ...page.content]);
      this.ultimaPagina.set(page.last);
    } catch {
      this.erro.set('Nao foi possivel carregar mais propostas. Tente novamente.');
    } finally {
      this.carregandoMais.set(false);
    }
  }

  aplicarFiltro(status: FiltroStatus): void {
    if (status === this.filtroStatus()) {
      return;
    }
    this.filtroStatus.set(status);
    void this.carregar();
  }

  async recarregar(event: Event): Promise<void> {
    await this.carregar();
    const refresher = event.target as HTMLElement & { complete?: () => Promise<void> };
    await refresher.complete?.();
  }

  abrirDetalhe(id: string): void {
    void this.router.navigate(['/app/propostas', id]);
  }

  protected rotuloStatus(status: StatusProposta): string {
    return ROTULOS_STATUS[status];
  }

  protected rotuloTipo(tipo: TipoOperacao): string {
    return ROTULOS_TIPO[tipo];
  }

  protected variante(status: StatusProposta): VarianteStatus {
    return varianteDoStatus(status);
  }

  protected valorFormatado(proposta: PropostaResponse): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: proposta.moeda,
    }).format(proposta.valorSolicitado);
  }

  protected dataFormatada(iso: string): string {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(iso));
  }

  private params(pagina: number): ListarPropostasParams {
    const params: ListarPropostasParams = { page: pagina, size: PAGE_SIZE };
    if (this.filtroStatus() !== 'TODAS') {
      params.status = this.filtroStatus() as StatusProposta;
    }
    return params;
  }
}

function varianteDoStatus(status: StatusProposta): VarianteStatus {
  switch (status) {
    case 'APROVADA':
      return 'aprovado';
    case 'REJEITADA':
      return 'reprovado';
    case 'PENDENCIA':
      return 'pendente';
    case 'EM_ANALISE':
    case 'PRE_APROVADA':
      return 'andamento';
  }
}
