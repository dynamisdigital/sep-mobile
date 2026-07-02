import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonContent,
  IonRefresher,
  IonRefresherContent,
  IonSpinner,
} from '@ionic/angular/standalone';

import { PropostaResponse, TipoOperacao } from '../../../core/api/api.models';
import { CreditoMobileService } from '../../../core/credito/credito-mobile.service';
import { HeaderMobileComponent } from '../../../layout/header-mobile/header-mobile.component';

const PAGE_SIZE = 20;

const ROTULOS_TIPO: Record<TipoOperacao, string> = {
  CAPITAL_GIRO: 'Capital de giro',
  OUTROS: 'Outros',
};

// Entrada da jornada de parcelas. Reutiliza as propostas APROVADAS do proprio tomador
// (CreditoMobileService) como ponto de partida — sao as aptas a ter contrato assinado e agenda
// gerada. NAO existe endpoint global de contratos/agendas: contrato e agenda so sao consultados ao
// abrir uma proposta (sem N+1). Ownership fica no backend. Lista vazia significa ausencia de
// propostas elegiveis na fonte atual, nunca divida quitada.
@Component({
  selector: 'sep-parcelas-entry',
  standalone: true,
  imports: [IonContent, IonRefresher, IonRefresherContent, IonSpinner, HeaderMobileComponent],
  templateUrl: './parcelas-entry.component.html',
  styleUrl: './parcelas-entry.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ParcelasEntryComponent implements OnInit {
  private readonly credito = inject(CreditoMobileService);
  private readonly router = inject(Router);

  readonly propostas = signal<PropostaResponse[]>([]);
  readonly carregando = signal(false);
  readonly carregandoMais = signal(false);
  readonly erro = signal<string | null>(null);
  readonly ultimaPagina = signal(true);

  private pagina = 0;
  // Cada `carregar()` invalida respostas anteriores ainda em voo (refresh durante carregarMais),
  // evitando que uma pagina obsoleta sobrescreva ou acrescente itens.
  private geracao = 0;

  ngOnInit(): void {
    void this.carregar();
  }

  async carregar(): Promise<void> {
    const geracao = ++this.geracao;
    this.carregando.set(true);
    this.erro.set(null);
    this.pagina = 0;
    try {
      const page = await this.credito.listarPropostas({
        status: 'APROVADA',
        page: 0,
        size: PAGE_SIZE,
      });
      if (geracao !== this.geracao) {
        return;
      }
      this.propostas.set(page.content);
      this.ultimaPagina.set(page.last);
    } catch {
      if (geracao !== this.geracao) {
        return;
      }
      this.propostas.set([]);
      this.erro.set('Nao foi possivel carregar as propostas. Tente novamente.');
    } finally {
      if (geracao === this.geracao) {
        this.carregando.set(false);
      }
    }
  }

  async carregarMais(): Promise<void> {
    if (this.carregandoMais() || this.ultimaPagina()) {
      return;
    }
    const geracao = this.geracao;
    this.carregandoMais.set(true);
    this.erro.set(null);
    try {
      const proxima = this.pagina + 1;
      const page = await this.credito.listarPropostas({
        status: 'APROVADA',
        page: proxima,
        size: PAGE_SIZE,
      });
      if (geracao !== this.geracao) {
        return;
      }
      this.pagina = proxima;
      this.propostas.update((atual) => [...atual, ...page.content]);
      this.ultimaPagina.set(page.last);
    } catch {
      if (geracao !== this.geracao) {
        return;
      }
      this.erro.set('Nao foi possivel carregar mais propostas. Tente novamente.');
    } finally {
      this.carregandoMais.set(false);
    }
  }

  async recarregar(event: Event): Promise<void> {
    await this.carregar();
    const refresher = event.target as HTMLElement & { complete?: () => Promise<void> };
    await refresher.complete?.();
  }

  abrirAgenda(propostaId: string): void {
    void this.router.navigate(['/app/parcelas/proposta', propostaId]);
  }

  protected rotuloTipo(tipo: TipoOperacao): string {
    return ROTULOS_TIPO[tipo];
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
}
