import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonRefresher,
  IonRefresherContent,
  IonSpinner,
} from '@ionic/angular/standalone';

import { OportunidadeResponse } from '../../../core/api/api.models';
import { CredoraMobileService } from '../../../core/credores/credora-mobile.service';
import { HeaderMobileComponent } from '../../../layout/header-mobile/header-mobile.component';
import { formatarData, formatarMoeda, formatarTaxaMensal } from '../shared/credora-format';
import { OportunidadeStatusComponent } from '../shared/oportunidade-status.component';

// Lista de oportunidades disponiveis para a credora autenticada. Consome
// GET /credores/oportunidades (nao paginado no contrato) e preserva a ordem do backend. Apenas
// apresenta valor/prazo/taxa/status/data; nao infere elegibilidade nem interesse. Nao expoe
// propostaId/contratoId. Um token de geracao descarta respostas obsoletas (pull-to-refresh).
@Component({
  selector: 'sep-credora-oportunidades',
  standalone: true,
  imports: [
    IonContent,
    IonRefresher,
    IonRefresherContent,
    IonSpinner,
    IonButton,
    HeaderMobileComponent,
    OportunidadeStatusComponent,
  ],
  templateUrl: './opportunity-list.component.html',
  styleUrl: './opportunity-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OpportunityListComponent implements OnInit {
  private readonly service = inject(CredoraMobileService);
  private readonly router = inject(Router);

  readonly oportunidades = signal<OportunidadeResponse[]>([]);
  readonly carregando = signal(true);
  readonly erro = signal<string | null>(null);

  protected readonly formatarMoeda = formatarMoeda;
  protected readonly formatarTaxaMensal = formatarTaxaMensal;
  protected readonly formatarData = formatarData;

  // Descarta respostas obsoletas quando um refresh mais novo comeca antes de o anterior responder.
  private geracao = 0;

  ngOnInit(): void {
    void this.carregar();
  }

  async carregar(): Promise<void> {
    const geracao = ++this.geracao;
    this.carregando.set(true);
    this.erro.set(null);
    try {
      const lista = await this.service.listarOportunidades();
      if (geracao !== this.geracao) {
        return;
      }
      this.oportunidades.set(lista);
    } catch {
      if (geracao !== this.geracao) {
        return;
      }
      this.oportunidades.set([]);
      this.erro.set('Nao foi possivel carregar as oportunidades. Tente novamente.');
    } finally {
      if (geracao === this.geracao) {
        this.carregando.set(false);
      }
    }
  }

  async recarregar(event: Event): Promise<void> {
    await this.carregar();
    const refresher = event.target as HTMLElement & { complete?: () => Promise<void> };
    await refresher.complete?.();
  }

  abrirDetalhe(id: string): void {
    void this.router.navigate(['/app/credora/oportunidades', id]);
  }
}
