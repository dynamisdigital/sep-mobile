import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ViewWillEnter } from '@ionic/angular';
import { IonButton, IonContent, IonSpinner } from '@ionic/angular/standalone';

import { OperacaoCarteiraResponse, PixOperacaoCredoraResponse } from '../../../core/api/api.models';
import { CredoraMobileService } from '../../../core/credores/credora-mobile.service';
import { PixMobileService } from '../../../core/pix/pix-mobile.service';
import { HeaderMobileComponent } from '../../../layout/header-mobile/header-mobile.component';
import { PixStatusPublicoComponent } from '../../pix/pix-status-publico.component';
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
  imports: [
    IonContent,
    IonSpinner,
    IonButton,
    HeaderMobileComponent,
    OperacaoStatusComponent,
    PixStatusPublicoComponent,
  ],
  templateUrl: './portfolio-detail.component.html',
  styleUrl: './portfolio-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PortfolioDetailComponent implements OnInit, ViewWillEnter {
  private readonly service = inject(CredoraMobileService);
  private readonly pix = inject(PixMobileService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly operacao = signal<OperacaoCarteiraResponse | null>(null);
  readonly carregando = signal(true);
  readonly erro = signal<string | null>(null);

  // Status Pix da operacao (M-11.4, backend Gate P3). Somente status/valor/data; nunca tomador,
  // contrato, transferencia, provider ou escrow.
  readonly statusPix = signal<PixOperacaoCredoraResponse | null>(null);
  readonly carregandoPix = signal(false);
  // 404 = ausencia neutra ("sem Pix"); distinto de erroPix (rede/5xx com retry).
  readonly pixIndisponivel = signal(false);
  readonly erroPix = signal<string | null>(null);

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
    this.resetarStatusPix();
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
    // Status Pix APOS liberar o spinner (nao bloqueia o detalhe; card tem loading proprio). So quando
    // ha operacao carregada; resposta obsoleta e descartada pela geracao.
    if (this.operacao()) {
      await this.consultarStatusPix(geracao);
    }
  }

  // Leitura owner-scoped do status Pix da operacao da propria carteira (Gate P3). 404 = ausencia
  // neutra ("sem Pix"); 403/rede/5xx = erro isolado com retry. Nao bloqueia o detalhe. Resposta de
  // geracao anterior nao sobrescreve a atual.
  async consultarStatusPix(geracao = this.geracao): Promise<void> {
    if (!this.id) {
      return;
    }
    this.carregandoPix.set(true);
    this.erroPix.set(null);
    try {
      const status = await this.pix.consultarStatusPixDaOperacao(this.id);
      if (geracao !== this.geracao) {
        return;
      }
      this.statusPix.set(status);
      this.pixIndisponivel.set(false);
    } catch (err) {
      if (geracao !== this.geracao) {
        return;
      }
      this.statusPix.set(null);
      if (err instanceof HttpErrorResponse && err.status === 404) {
        this.pixIndisponivel.set(true);
      } else {
        this.erroPix.set('Nao foi possivel carregar o status Pix. Tente novamente.');
      }
    } finally {
      if (geracao === this.geracao) {
        this.carregandoPix.set(false);
      }
    }
  }

  private resetarStatusPix(): void {
    this.statusPix.set(null);
    this.carregandoPix.set(false);
    this.pixIndisponivel.set(false);
    this.erroPix.set(null);
  }

  voltarParaLista(): void {
    void this.router.navigate(['/app/credora/carteira']);
  }
}
