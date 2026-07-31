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
import { IonContent, IonSpinner } from '@ionic/angular/standalone';

import {
  PixPagamentoParcelaResponse,
  RecebimentoTomadorResponse,
  ValorAtualizadoParcelaResponse,
} from '../../../core/api/api.models';
import { CobrancaMobileService } from '../../../core/cobranca/cobranca-mobile.service';
import { PixMobileService } from '../../../core/pix/pix-mobile.service';
import { HeaderMobileComponent } from '../../../layout/header-mobile/header-mobile.component';
import { PixStatusParcelaComponent } from '../../pix/pix-status-parcela.component';
import { ParcelaStatusComponent } from './parcela-status.component';

// Detalhe de uma parcela com o valor atualizado calculado pelo backend (`consultarParcela`). O app
// apenas exibe os campos recebidos (principal, juros, mora, multa, valor devido, total recebido,
// valor em aberto): nao soma campos para validar total, nao substitui ausentes por calculo, nao
// deriva atraso/status por data ou valor. Datas/valores sao formatados em pt-BR/BRL apenas para
// exibicao. Atualizacao e sob demanda (sem polling); um token de geracao descarta resposta obsoleta
// para que uma consulta anterior nao sobrescreva a atual. 403 mostra mensagem neutra (nao diferencia
// parcela alheia de inexistente); 404 informa indisponibilidade com retorno a agenda; rede/5xx
// mantem o ultimo snapshot marcado como desatualizado. Nada e persistido localmente.
//
// Historico de recebimentos (M-9.4, backend B1/Sprint 23): secao recolhida por padrao, carregada
// sob demanda pelo endpoint owner-scoped do tomador (nunca o GET /recebimentos interno). A ordem
// (DESC) vem do backend; o app nao reordena, nao soma o historico para "conferir" o totalRecebido
// (que segue autoritativo no detalhe) e nao classifica recebimento como parcial/excedente. Falha do
// historico e isolada: mostra erro proprio com retry e nao bloqueia nem apaga o detalhe da parcela.
@Component({
  selector: 'sep-parcela-detail',
  standalone: true,
  imports: [
    IonContent,
    IonSpinner,
    HeaderMobileComponent,
    ParcelaStatusComponent,
    PixStatusParcelaComponent,
  ],
  templateUrl: './parcela-detail.component.html',
  styleUrl: './parcela-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ParcelaDetailComponent implements OnInit, ViewWillEnter {
  private readonly cobranca = inject(CobrancaMobileService);
  private readonly pix = inject(PixMobileService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly parcela = signal<ValorAtualizadoParcelaResponse | null>(null);
  readonly carregando = signal(true);
  readonly erro = signal<string | null>(null);
  // Snapshot exibido pode estar desatualizado (falha de rede/conflito ao atualizar pos-carga).
  readonly desatualizado = signal(false);
  // Momento da tela (nao e data calculada pelo backend); apenas informa quando foi consultado.
  readonly consultadoEm = signal<string | null>(null);

  // Parcela substituida por nova agenda: oferece retorno para a agenda ativa.
  readonly foiRenegociada = computed(() => this.parcela()?.status === 'RENEGOCIADA');
  // Proposta de renegociacao em andamento: habilita o CTA para os termos (M-9.5, backend B2).
  readonly emNegociacao = computed(() => this.parcela()?.status === 'EM_NEGOCIACAO');

  // Historico de recebimentos (M-9.4): null = nunca carregado (lazy); [] = carregado e vazio.
  readonly historicoAberto = signal(false);
  readonly recebimentos = signal<RecebimentoTomadorResponse[] | null>(null);
  readonly historicoCarregando = signal(false);
  readonly historicoErro = signal<string | null>(null);

  // Status Pix da parcela (M-11.3, backend Gate P2). Complementa — nao substitui — o status
  // autoritativo de cobranca exibido no cabecalho.
  readonly statusPix = signal<PixPagamentoParcelaResponse | null>(null);
  readonly carregandoPix = signal(false);
  // 404 = ausencia neutra ("sem pagamento Pix"); distinto de erroPix (rede/5xx com retry).
  readonly pixIndisponivel = signal(false);
  readonly erroPix = signal<string | null>(null);

  private contratoId = '';
  private parcelaId = '';
  private geracao = 0;

  async ngOnInit(): Promise<void> {
    this.contratoId = this.route.snapshot.paramMap.get('contratoId') ?? '';
    this.parcelaId = this.route.snapshot.paramMap.get('parcelaId') ?? '';
    await this.carregar();
  }

  // Reentrada via stack do ion-router-outlet (ex.: retorno da decisao de renegociacao): o
  // componente e reutilizado sem novo ngOnInit. Reconsulta para nao exibir snapshot obsoleto;
  // o guard evita duplicar a carga inicial (ionViewWillEnter tambem dispara na primeira entrada).
  ionViewWillEnter(): void {
    if (this.parcelaId && !this.carregando()) {
      void this.carregar();
    }
  }

  async carregar(): Promise<void> {
    const geracao = ++this.geracao;
    this.carregando.set(true);
    this.erro.set(null);
    this.resetarStatusPix();
    try {
      const parcela = await this.cobranca.consultarParcela(this.parcelaId);
      if (geracao !== this.geracao) {
        return;
      }
      this.parcela.set(parcela);
      this.desatualizado.set(false);
      this.consultadoEm.set(this.horaAtual());
    } catch (err) {
      if (geracao !== this.geracao) {
        return;
      }
      this.tratarErro(err);
    } finally {
      if (geracao === this.geracao) {
        this.carregando.set(false);
      }
    }
    // Status Pix APOS liberar o spinner do detalhe (nao bloqueia o render; o card tem loading
    // proprio). So consulta quando ha parcela carregada; resposta obsoleta e descartada pela geracao.
    if (this.parcela()) {
      await this.consultarStatusPix(geracao);
    }
  }

  // Leitura owner-scoped do status Pix da parcela (Gate P2). 404 = ausencia neutra ("sem pagamento
  // Pix"); 403/rede/5xx = erro isolado com retry. Complementa o status de cobranca (nao substitui) e
  // nao bloqueia o detalhe. Resposta de geracao anterior nao sobrescreve a atual.
  async consultarStatusPix(geracao = this.geracao): Promise<void> {
    // Chamada de geracao vencida nao pode nem comecar: ela tomaria a guarda abaixo, faria o
    // `carregar()` corrente desistir da propria leitura e depois pularia o reset do `finally` (que
    // exige geracao igual), prendendo `carregandoPix` em true — spinner eterno e retry
    // desabilitado. Hoje esta e a unica leitura depois do `try`, entao a geracao nunca chega
    // vencida; a linha existe para que acrescentar outra leitura antes dela nao reintroduza o
    // defeito, que e o que aconteceu com `consultarAportes` no portfolio-detail.
    if (geracao !== this.geracao) {
      return;
    }
    // Uma request por gesto: o [disabled] do botao so vale a partir do proximo ciclo de change
    // detection, entao um duplo toque cabe na fresta e dispararia duas leituras concorrentes com
    // a mesma geracao — o guard de geracao nao descartaria nenhuma, a ultima a responder venceria
    // e o finally da primeira reabilitaria o botao com request ainda em voo.
    if (!this.parcelaId || this.carregandoPix()) {
      return;
    }
    this.carregandoPix.set(true);
    this.erroPix.set(null);
    // Limpa a ausencia da leitura anterior: sem isso, um 404 seguido de retry com 5xx manteria
    // "indisponivel" com prioridade no template e esconderia o erro tecnico.
    this.pixIndisponivel.set(false);
    try {
      const status = await this.pix.consultarStatusPixDaParcela(this.parcelaId);
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

  voltarParaAgenda(): void {
    void this.router.navigate(['/app/parcelas/contratos', this.contratoId]);
  }

  // Termos da renegociacao ativa (M-9.5). A leitura e a decisao ficam na rota dedicada.
  verRenegociacao(): void {
    void this.router.navigate([
      '/app/parcelas/contratos',
      this.contratoId,
      'parcelas',
      this.parcelaId,
      'renegociacao',
    ]);
  }

  // Abre/recolhe a secao. Carrega apenas na primeira abertura; reabrir nao refaz a consulta
  // (o refresh explicito fica no botao "Atualizar historico").
  alternarHistorico(): void {
    const abrir = !this.historicoAberto();
    this.historicoAberto.set(abrir);
    if (abrir && this.recebimentos() === null && !this.historicoCarregando()) {
      void this.carregarHistorico();
    }
  }

  async carregarHistorico(): Promise<void> {
    if (this.historicoCarregando()) {
      return;
    }
    this.historicoCarregando.set(true);
    this.historicoErro.set(null);
    try {
      // Ordem DESC vem do backend; o app nao reordena nem agrega.
      this.recebimentos.set(await this.cobranca.consultarRecebimentos(this.parcelaId));
    } catch {
      // Falha isolada: o detalhe da parcela permanece intacto e utilizavel.
      this.historicoErro.set('Nao foi possivel carregar o historico. Tente novamente.');
    } finally {
      this.historicoCarregando.set(false);
    }
  }

  protected valorFormatado(valor: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
  }

  // dataVencimento e LocalDate (yyyy-MM-dd). Fixa meio-dia local para exibir sem deslocamento de
  // fuso. Formatacao e apenas apresentacao; nenhuma aritmetica de data ocorre aqui.
  protected dataVencimentoFormatada(data: string): string {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(`${data}T12:00:00`));
  }

  // dataRecebimento e ISO-8601 com offset; exibe data e hora locais, sem aritmetica.
  protected dataRecebimentoFormatada(data: string): string {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(data));
  }

  private horaAtual(): string {
    return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(
      new Date(),
    );
  }

  private resetarStatusPix(): void {
    this.statusPix.set(null);
    this.carregandoPix.set(false);
    this.pixIndisponivel.set(false);
    this.erroPix.set(null);
  }

  private tratarErro(err: unknown): void {
    const temSnapshot = this.parcela() !== null;
    if (err instanceof HttpErrorResponse) {
      // 403: ownership. Nunca diferencia parcela alheia de inexistente.
      if (err.status === 403) {
        this.parcela.set(null);
        this.erro.set('Voce nao tem acesso a esta parcela.');
        return;
      }
      // 404: parcela indisponivel; a UI oferece voltar a agenda.
      if (err.status === 404) {
        this.parcela.set(null);
        this.erro.set('Parcela indisponivel.');
        return;
      }
      // 409: conflito de leitura. Nao inventa estado; mantem o snapshot e pede nova tentativa.
      if (err.status === 409 && temSnapshot) {
        this.desatualizado.set(true);
        this.erro.set('A parcela mudou. Atualize para ver os dados mais recentes.');
        return;
      }
    }
    // Rede/5xx: mantem o ultimo snapshot (marcado desatualizado) quando existir; senao, erro cheio.
    if (temSnapshot) {
      this.desatualizado.set(true);
      this.erro.set('Nao foi possivel atualizar. Mostrando os dados anteriores.');
    } else {
      this.erro.set('Nao foi possivel carregar a parcela. Tente novamente.');
    }
  }
}
