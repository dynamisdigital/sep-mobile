import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { IonButton, IonContent, IonSpinner } from '@ionic/angular/standalone';

import {
  ApiErrorResponse,
  DecisaoParecer,
  PropostaResponse,
  TipoOperacao,
} from '../../../core/api/api.models';
import { CreditoMobileService } from '../../../core/credito/credito-mobile.service';
import { HeaderMobileComponent } from '../../../layout/header-mobile/header-mobile.component';
import { PropostaStatusComponent } from './proposta-status.component';

const ROTULOS_TIPO: Record<TipoOperacao, string> = {
  CAPITAL_GIRO: 'Capital de giro',
  OUTROS: 'Outros',
};

// Feedback do parecer apresentado ao tomador (sem reinterpretacao local). Espelha a decisao
// do operador; o app nao recalcula nem deriva aprovacao.
const ROTULOS_DECISAO: Record<DecisaoParecer, string> = {
  APROVAR: 'Aprovado',
  REJEITAR: 'Reprovado',
  PENDENCIA: 'Pendencia',
};

// Detalhe da proposta do tomador. Apresenta status e, quando houver, o feedback do ultimo
// parecer (decisao, justificativa, data). Nao exibe score interno, pareceristaId, IDs
// tecnicos, trilha de regras nem acao de registrar parecer; nao infere transicao de status
// (PRE_APROVADA nunca e apresentada como aprovacao final — ver PropostaStatusComponent).
@Component({
  selector: 'sep-proposta-detail',
  standalone: true,
  imports: [IonContent, IonButton, IonSpinner, HeaderMobileComponent, PropostaStatusComponent],
  templateUrl: './proposta-detail.component.html',
  styleUrl: './proposta-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PropostaDetailComponent implements OnInit {
  private readonly credito = inject(CreditoMobileService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly proposta = signal<PropostaResponse | null>(null);
  readonly carregando = signal(true);
  readonly erro = signal<string | null>(null);

  private id = '';

  async ngOnInit(): Promise<void> {
    this.id = this.route.snapshot.paramMap.get('id') ?? '';
    await this.carregar();
  }

  async carregar(): Promise<void> {
    this.carregando.set(true);
    this.erro.set(null);
    try {
      const proposta = await this.credito.consultarProposta(this.id);
      this.proposta.set(proposta);
    } catch (err) {
      this.proposta.set(null);
      this.erro.set(this.mensagemErro(err));
    } finally {
      this.carregando.set(false);
    }
  }

  abrirOpenFinance(): void {
    void this.router.navigate(['/app/propostas', this.id, 'open-finance']);
  }

  protected rotuloTipo(tipo: TipoOperacao): string {
    return ROTULOS_TIPO[tipo];
  }

  protected rotuloDecisao(decisao: DecisaoParecer): string {
    return ROTULOS_DECISAO[decisao];
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

  private mensagemErro(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      if (err.status === 404) {
        return 'Proposta nao encontrada.';
      }
      const mensagem = (err.error as ApiErrorResponse | undefined)?.message;
      if (mensagem) {
        return mensagem;
      }
    }
    return 'Nao foi possivel carregar a proposta. Tente novamente.';
  }
}
