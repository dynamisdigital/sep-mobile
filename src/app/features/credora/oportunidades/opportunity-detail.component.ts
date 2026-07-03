import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ViewWillEnter } from '@ionic/angular';
import { IonButton, IonContent, IonSpinner } from '@ionic/angular/standalone';

import { OportunidadeResponse } from '../../../core/api/api.models';
import { CredoraMobileService } from '../../../core/credores/credora-mobile.service';
import { HeaderMobileComponent } from '../../../layout/header-mobile/header-mobile.component';
import { formatarData, formatarMoeda, formatarTaxaMensal } from '../shared/credora-format';
import { OportunidadeStatusComponent } from '../shared/oportunidade-status.component';

// Detalhe read-only de uma oportunidade. Reconsulta ao entrar/reentrar na stack do Ionic
// (ionViewWillEnter) para nao exibir snapshot obsoleto; um token de geracao descarta respostas
// obsoletas. `DISPONIVEL` e apenas potencialmente acionavel — elegibilidade e interesse continuam
// no backend; a manifestacao de interesse chega na Task M-10.4. `ENCERRADA` nao oferece acao.
// 404 recebe mensagem neutra e retorno para a lista. Nao expoe propostaId/contratoId.
@Component({
  selector: 'sep-credora-oportunidade-detalhe',
  standalone: true,
  imports: [IonContent, IonSpinner, IonButton, HeaderMobileComponent, OportunidadeStatusComponent],
  templateUrl: './opportunity-detail.component.html',
  styleUrl: './opportunity-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OpportunityDetailComponent implements OnInit, ViewWillEnter {
  private readonly service = inject(CredoraMobileService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly oportunidade = signal<OportunidadeResponse | null>(null);
  readonly carregando = signal(true);
  readonly erro = signal<string | null>(null);

  readonly encerrada = computed(() => this.oportunidade()?.status === 'ENCERRADA');

  protected readonly formatarMoeda = formatarMoeda;
  protected readonly formatarTaxaMensal = formatarTaxaMensal;
  protected readonly formatarData = formatarData;

  private id = '';
  private geracao = 0;

  async ngOnInit(): Promise<void> {
    this.id = this.route.snapshot.paramMap.get('oportunidadeId') ?? '';
    await this.carregar();
  }

  // Reentrada via stack do ion-router-outlet: o componente e reutilizado sem novo ngOnInit.
  // Reconsulta; o guard evita duplicar a carga inicial (ionViewWillEnter tambem dispara na entrada).
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
      const oportunidade = await this.service.consultarOportunidade(this.id);
      if (geracao !== this.geracao) {
        return;
      }
      this.oportunidade.set(oportunidade);
    } catch (err) {
      if (geracao !== this.geracao) {
        return;
      }
      this.oportunidade.set(null);
      this.erro.set(
        err instanceof HttpErrorResponse && err.status === 404
          ? 'Oportunidade indisponivel.'
          : 'Nao foi possivel carregar a oportunidade. Tente novamente.',
      );
    } finally {
      if (geracao === this.geracao) {
        this.carregando.set(false);
      }
    }
  }

  voltarParaLista(): void {
    void this.router.navigate(['/app/credora/oportunidades']);
  }
}
