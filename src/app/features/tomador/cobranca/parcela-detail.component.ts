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
import { IonContent, IonSpinner } from '@ionic/angular/standalone';

import { ValorAtualizadoParcelaResponse } from '../../../core/api/api.models';
import { CobrancaMobileService } from '../../../core/cobranca/cobranca-mobile.service';
import { HeaderMobileComponent } from '../../../layout/header-mobile/header-mobile.component';
import { ParcelaStatusComponent } from './parcela-status.component';

// Detalhe de uma parcela com o valor atualizado calculado pelo backend (`consultarParcela`). O app
// apenas exibe os campos recebidos (principal, juros, mora, multa, valor devido, total recebido,
// valor em aberto): nao soma campos para validar total, nao substitui ausentes por calculo, nao
// deriva atraso/status por data ou valor. Datas/valores sao formatados em pt-BR/BRL apenas para
// exibicao. Atualizacao e sob demanda (sem polling); um token de geracao descarta resposta obsoleta
// para que uma consulta anterior nao sobrescreva a atual. 403 mostra mensagem neutra (nao diferencia
// parcela alheia de inexistente); 404 informa indisponibilidade com retorno a agenda; rede/5xx
// mantem o ultimo snapshot marcado como desatualizado. Nada e persistido localmente.
@Component({
  selector: 'sep-parcela-detail',
  standalone: true,
  imports: [IonContent, IonSpinner, HeaderMobileComponent, ParcelaStatusComponent],
  templateUrl: './parcela-detail.component.html',
  styleUrl: './parcela-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ParcelaDetailComponent implements OnInit {
  private readonly cobranca = inject(CobrancaMobileService);
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
  // Proposta de renegociacao em andamento. O CTA para os termos entra na M-9.5 (gate B2); aqui
  // apenas sinaliza o estado.
  readonly emNegociacao = computed(() => this.parcela()?.status === 'EM_NEGOCIACAO');

  private contratoId = '';
  private parcelaId = '';
  private geracao = 0;

  async ngOnInit(): Promise<void> {
    this.contratoId = this.route.snapshot.paramMap.get('contratoId') ?? '';
    this.parcelaId = this.route.snapshot.paramMap.get('parcelaId') ?? '';
    await this.carregar();
  }

  async carregar(): Promise<void> {
    const geracao = ++this.geracao;
    this.carregando.set(true);
    this.erro.set(null);
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
  }

  voltarParaAgenda(): void {
    void this.router.navigate(['/app/parcelas/contratos', this.contratoId]);
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

  private horaAtual(): string {
    return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(
      new Date(),
    );
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
