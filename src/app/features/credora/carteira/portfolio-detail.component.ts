import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ViewWillEnter } from '@ionic/angular';
import { IonButton, IonContent, IonSpinner } from '@ionic/angular/standalone';

import {
  AporteCredoraResponse,
  OperacaoCarteiraResponse,
  PixOperacaoCredoraResponse,
} from '../../../core/api/api.models';
import { CredoraMobileService } from '../../../core/credores/credora-mobile.service';
import { PixMobileService } from '../../../core/pix/pix-mobile.service';
import { HeaderMobileComponent } from '../../../layout/header-mobile/header-mobile.component';
import { PixStatusPublicoComponent } from '../../pix/pix-status-publico.component';
import { AporteStatusComponent } from '../shared/aporte-status.component';
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
    AporteStatusComponent,
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

  // Aportes owner-scoped da propria operacao (M-16.4, backend Sprint 29). Somente leitura: a
  // credora nao registra aporte pelo app (POST exige FINANCEIRO/ADMIN — Gate M-16.0). Lista vazia
  // e estado valido e distinto de aportesIndisponiveis (404 neutro) e de erroAportes (rede/5xx).
  readonly aportes = signal<AporteCredoraResponse[]>([]);
  readonly carregandoAportes = signal(false);
  readonly aportesIndisponiveis = signal(false);
  readonly erroAportes = signal<string | null>(null);

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
    this.resetarAportes();
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
    // Status Pix e aportes APOS liberar o spinner (nao bloqueiam o detalhe; cada card tem loading
    // proprio). So quando ha operacao carregada; resposta obsoleta e descartada pela geracao.
    if (this.operacao()) {
      await this.consultarStatusPix(geracao);
      await this.consultarAportes(geracao);
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
    // Limpa a ausencia da leitura anterior: sem isso, um 404 seguido de retry com 5xx manteria
    // "indisponivel" com prioridade no template e esconderia o erro tecnico.
    this.pixIndisponivel.set(false);
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

  // Leitura owner-scoped dos aportes da propria operacao (backend Sprint 29). 404 = ausencia
  // neutra (operacao indisponivel, sem enumerar); 403/rede/5xx = erro isolado com retry. Nunca
  // derruba o detalhe ja carregado. Resposta de geracao anterior nao sobrescreve a atual.
  async consultarAportes(geracao = this.geracao): Promise<void> {
    // Uma request por gesto: o [disabled] do botao so vale a partir do proximo ciclo de change
    // detection, entao um duplo toque cabe na fresta e dispararia duas leituras concorrentes com
    // a mesma geracao — a ultima a responder venceria, podendo reexibir estado mais velho.
    if (!this.id || this.carregandoAportes()) {
      return;
    }
    this.carregandoAportes.set(true);
    this.erroAportes.set(null);
    // Limpa a ausencia da leitura anterior: sem isso, um 404 seguido de retry com 5xx manteria
    // "indisponivel" com prioridade no template e esconderia o erro tecnico.
    this.aportesIndisponiveis.set(false);
    try {
      const aportes = await this.service.listarAportes(this.id);
      if (geracao !== this.geracao) {
        return;
      }
      // Ordem preservada como veio do backend; o app nao reordena nem agrega.
      this.aportes.set(aportes);
      this.aportesIndisponiveis.set(false);
    } catch (err) {
      if (geracao !== this.geracao) {
        return;
      }
      this.aportes.set([]);
      if (err instanceof HttpErrorResponse && err.status === 404) {
        this.aportesIndisponiveis.set(true);
      } else {
        this.erroAportes.set('Nao foi possivel carregar os aportes. Tente novamente.');
      }
    } finally {
      if (geracao === this.geracao) {
        this.carregandoAportes.set(false);
      }
    }
  }

  private resetarAportes(): void {
    this.aportes.set([]);
    this.carregandoAportes.set(false);
    this.aportesIndisponiveis.set(false);
    this.erroAportes.set(null);
  }

  voltarParaLista(): void {
    void this.router.navigate(['/app/credora/carteira']);
  }
}
