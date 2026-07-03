import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ViewWillEnter } from '@ionic/angular';
import { IonButton, IonContent, IonSpinner } from '@ionic/angular/standalone';

import { OperacaoCarteiraResponse } from '../../../core/api/api.models';
import { CredoraMobileService } from '../../../core/credores/credora-mobile.service';
import { HeaderMobileComponent } from '../../../layout/header-mobile/header-mobile.component';
import {
  formatarData,
  formatarDataLocal,
  formatarMoeda,
  formatarTaxaMensal,
} from '../shared/credora-format';
import { OperacaoStatusComponent } from '../shared/operacao-status.component';

// Detalhe read-only de uma operacao da carteira. Apresenta os termos do snapshot, o status
// contratual e o resumo de cobranca quando presentes; os agregados (parcelasPagas,
// parcelasAtrasadas, totalRecebido, proximoVencimento) sao exibidos diretamente, sem recalcular
// saldo ou inadimplencia. Campos nullable viram "Nao informado" (sem zero inventado). Nao exibe a
// justificativa operacional, IDs de contrato/oportunidade nem dados do tomador. 404 recebe mensagem
// neutra e retorno a carteira. Reconsulta ao entrar/reentrar na stack do Ionic; sem polling.
@Component({
  selector: 'sep-credora-operacao-detalhe',
  standalone: true,
  imports: [IonContent, IonSpinner, IonButton, HeaderMobileComponent, OperacaoStatusComponent],
  templateUrl: './portfolio-detail.component.html',
  styleUrl: './portfolio-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PortfolioDetailComponent implements OnInit, ViewWillEnter {
  private readonly service = inject(CredoraMobileService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly operacao = signal<OperacaoCarteiraResponse | null>(null);
  readonly carregando = signal(true);
  readonly erro = signal<string | null>(null);

  protected readonly formatarMoeda = formatarMoeda;
  protected readonly formatarTaxaMensal = formatarTaxaMensal;
  protected readonly formatarData = formatarData;
  protected readonly formatarDataLocal = formatarDataLocal;

  private id = '';
  private geracao = 0;

  async ngOnInit(): Promise<void> {
    this.id = this.route.snapshot.paramMap.get('operacaoId') ?? '';
    await this.carregar();
  }

  ionViewWillEnter(): void {
    if (this.id && !this.carregando()) {
      void this.carregar();
    }
  }

  async carregar(): Promise<void> {
    const geracao = ++this.geracao;
    this.carregando.set(true);
    this.erro.set(null);
    try {
      const operacao = await this.service.consultarOperacao(this.id);
      if (geracao !== this.geracao) {
        return;
      }
      this.operacao.set(operacao);
    } catch (err) {
      if (geracao !== this.geracao) {
        return;
      }
      this.operacao.set(null);
      this.erro.set(
        err instanceof HttpErrorResponse && err.status === 404
          ? 'Operacao indisponivel.'
          : 'Nao foi possivel carregar a operacao. Tente novamente.',
      );
    } finally {
      if (geracao === this.geracao) {
        this.carregando.set(false);
      }
    }
  }

  voltarParaLista(): void {
    void this.router.navigate(['/app/credora/carteira']);
  }
}
