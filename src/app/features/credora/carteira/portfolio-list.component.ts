import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonRefresher,
  IonRefresherContent,
  IonSpinner,
} from '@ionic/angular/standalone';

import { OperacaoCarteiraResponse } from '../../../core/api/api.models';
import { CredoraMobileService } from '../../../core/credores/credora-mobile.service';
import { HeaderMobileComponent } from '../../../layout/header-mobile/header-mobile.component';
import { formatarData, formatarMoeda, formatarTaxaMensal } from '../shared/credora-format';
import { OperacaoStatusComponent } from '../shared/operacao-status.component';

// Lista da carteira de operacoes financiadas da credora. Consome GET /credores/carteira (nao
// paginado) e preserva a ordem do backend. Apenas apresenta status/valor/prazo/taxa/data; campos
// nullable viram "Nao informado" (sem zero inventado). Nao soma valores para criar "total
// aportado", nao expoe justificativa nem IDs de contrato/oportunidade. Token de geracao descarta
// respostas obsoletas (pull-to-refresh).
@Component({
  selector: 'sep-credora-carteira',
  standalone: true,
  imports: [
    IonContent,
    IonRefresher,
    IonRefresherContent,
    IonSpinner,
    IonButton,
    HeaderMobileComponent,
    OperacaoStatusComponent,
  ],
  templateUrl: './portfolio-list.component.html',
  styleUrl: './portfolio-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PortfolioListComponent implements OnInit {
  private readonly service = inject(CredoraMobileService);
  private readonly router = inject(Router);

  readonly operacoes = signal<OperacaoCarteiraResponse[]>([]);
  readonly carregando = signal(true);
  readonly erro = signal<string | null>(null);

  protected readonly formatarMoeda = formatarMoeda;
  protected readonly formatarTaxaMensal = formatarTaxaMensal;
  protected readonly formatarData = formatarData;

  private geracao = 0;

  ngOnInit(): void {
    void this.carregar();
  }

  async carregar(): Promise<void> {
    const geracao = ++this.geracao;
    this.carregando.set(true);
    this.erro.set(null);
    try {
      const lista = await this.service.listarCarteira();
      if (geracao !== this.geracao) {
        return;
      }
      this.operacoes.set(lista);
    } catch {
      if (geracao !== this.geracao) {
        return;
      }
      this.operacoes.set([]);
      this.erro.set('Nao foi possivel carregar a carteira. Tente novamente.');
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
    void this.router.navigate(['/app/credora/carteira', id]);
  }
}
