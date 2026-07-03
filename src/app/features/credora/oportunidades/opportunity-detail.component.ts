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

import { InteresseResponse, OportunidadeResponse } from '../../../core/api/api.models';
import { CredoraContextStore } from '../../../core/credores/credora-context.store';
import { CredoraMobileService } from '../../../core/credores/credora-mobile.service';
import { HeaderMobileComponent } from '../../../layout/header-mobile/header-mobile.component';
import { formatarData, formatarMoeda, formatarTaxaMensal } from '../shared/credora-format';
import { OportunidadeStatusComponent } from '../shared/oportunidade-status.component';

type InteresseEstado = 'carregando' | 'ativo' | 'ausente' | 'erro';

// Copy obrigatoria: interesse registra intencao, nunca aporte/reserva/matching/alocacao/carteira.
const COPY_INTERESSE =
  'Manifestar interesse registra sua intencao. Nao representa aporte, reserva, matching, ' +
  'alocacao ou operacao de carteira. A associacao da carteira e assistida e ocorre fora do app.';

// Detalhe read-only da oportunidade + manifestacao/cancelamento de interesse (Task M-10.4, sobre o
// contrato autoritativo da Sprint 25). O estado do interesse vem sempre do backend
// (GET .../interesses/me): 200 ATIVO habilita cancelar; 404 habilita manifestar. Nada e persistido
// nem inferido localmente. Toda mutacao exige confirmacao explicita, bloqueia duplo submit e
// reconsulta o estado autoritativo depois; erro nunca vira sucesso presumido. Nenhuma acao inicia
// ou consome step-up. Reconsulta ao entrar/reentrar na stack do Ionic. Nao expoe propostaId/
// contratoId. A associacao de carteira e assistida e ocorre fora do app.
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
  private readonly store = inject(CredoraContextStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly copyInteresse = COPY_INTERESSE;

  readonly oportunidade = signal<OportunidadeResponse | null>(null);
  readonly carregando = signal(true);
  readonly erro = signal<string | null>(null);

  readonly interesse = signal<InteresseResponse | null>(null);
  readonly interesseEstado = signal<InteresseEstado>('carregando');

  readonly confirmacaoManifestarAberta = signal(false);
  readonly confirmacaoCancelarAberta = signal(false);
  readonly enviando = signal(false);
  readonly interesseMensagem = signal<string | null>(null);

  readonly encerrada = computed(() => this.oportunidade()?.status === 'ENCERRADA');
  // Elegibilidade e apenas dica de UX; o backend e a autoridade final (422 na mutacao).
  readonly credoraElegivel = computed(() => {
    const c = this.store.credora();
    return !!c && c.status === 'ATIVA' && c.elegibilidade === 'ELEGIVEL';
  });
  readonly podeManifestar = computed(
    () => this.interesseEstado() === 'ausente' && !this.encerrada() && this.credoraElegivel(),
  );

  protected readonly formatarMoeda = formatarMoeda;
  protected readonly formatarTaxaMensal = formatarTaxaMensal;
  protected readonly formatarData = formatarData;

  private id = '';
  private geracao = 0;

  async ngOnInit(): Promise<void> {
    this.id = this.route.snapshot.paramMap.get('oportunidadeId') ?? '';
    // Presenca/elegibilidade da credora para a dica de UX (dedup no store; sem bloquear a tela).
    void this.store.carregar();
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
    this.interesseMensagem.set(null);
    this.fecharConfirmacoes();
    try {
      const oportunidade = await this.service.consultarOportunidade(this.id);
      if (geracao !== this.geracao) {
        return;
      }
      this.oportunidade.set(oportunidade);
      await this.carregarInteresse(geracao);
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

  // Leitura autoritativa do interesse ativo. 404 e o caso normal "sem interesse" (nao e erro).
  private async carregarInteresse(geracao: number): Promise<void> {
    this.interesseEstado.set('carregando');
    try {
      const interesse = await this.service.consultarInteresseAtivo(this.id);
      if (geracao !== this.geracao) {
        return;
      }
      this.interesse.set(interesse);
      this.interesseEstado.set('ativo');
    } catch (err) {
      if (geracao !== this.geracao) {
        return;
      }
      this.interesse.set(null);
      this.interesseEstado.set(
        err instanceof HttpErrorResponse && err.status === 404 ? 'ausente' : 'erro',
      );
    }
  }

  // Reconsulta os termos/estado imediatamente antes de abrir a confirmacao: a decisao nunca ocorre
  // sobre snapshot velho.
  async abrirManifestar(): Promise<void> {
    if (this.enviando()) {
      return;
    }
    this.interesseMensagem.set(null);
    await this.carregar();
    if (this.podeManifestar()) {
      this.confirmacaoManifestarAberta.set(true);
    }
  }

  async abrirCancelar(): Promise<void> {
    if (this.enviando()) {
      return;
    }
    this.interesseMensagem.set(null);
    await this.carregar();
    if (this.interesseEstado() === 'ativo') {
      this.confirmacaoCancelarAberta.set(true);
    }
  }

  cancelarConfirmacao(): void {
    this.fecharConfirmacoes();
  }

  async confirmarManifestar(): Promise<void> {
    if (this.enviando()) {
      return;
    }
    this.enviando.set(true);
    this.interesseMensagem.set(null);
    try {
      await this.service.registrarInteresse(this.id);
      this.fecharConfirmacoes();
      await this.carregar(); // 201: reconsulta autoritativa
    } catch (err) {
      await this.tratarErroMutacao(err);
    } finally {
      this.enviando.set(false);
    }
  }

  async confirmarCancelar(): Promise<void> {
    if (this.enviando()) {
      return;
    }
    this.enviando.set(true);
    this.interesseMensagem.set(null);
    try {
      await this.service.cancelarInteresse(this.id);
      this.fecharConfirmacoes();
      await this.carregar(); // 204: reconsulta autoritativa
    } catch (err) {
      await this.tratarErroMutacao(err);
    } finally {
      this.enviando.set(false);
    }
  }

  voltarParaLista(): void {
    void this.router.navigate(['/app/credora/oportunidades']);
  }

  private fecharConfirmacoes(): void {
    this.confirmacaoManifestarAberta.set(false);
    this.confirmacaoCancelarAberta.set(false);
  }

  // Erro de mutacao nunca vira sucesso presumido:
  // 409/404 -> reconsulta o estado autoritativo; 422 -> informa sem alterar; rede/5xx -> informa.
  private async tratarErroMutacao(err: unknown): Promise<void> {
    this.fecharConfirmacoes();
    if (err instanceof HttpErrorResponse) {
      if (err.status === 409 || err.status === 404) {
        await this.carregar();
        return;
      }
      if (err.status === 422) {
        this.interesseMensagem.set(
          'Nao foi possivel manifestar interesse: credora nao elegivel ou oportunidade indisponivel.',
        );
        return;
      }
    }
    this.interesseMensagem.set('Nao foi possivel concluir a acao. Tente novamente.');
  }
}
