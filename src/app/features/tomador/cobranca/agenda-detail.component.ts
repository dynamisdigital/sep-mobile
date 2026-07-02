import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { IonContent, IonSpinner } from '@ionic/angular/standalone';

import { AgendaPagamentoResponse } from '../../../core/api/api.models';
import { CobrancaMobileService } from '../../../core/cobranca/cobranca-mobile.service';
import { ContratosMobileService } from '../../../core/contratos/contratos-mobile.service';
import { HeaderMobileComponent } from '../../../layout/header-mobile/header-mobile.component';
import { ParcelaStatusComponent } from './parcela-status.component';

// Agenda e lista de parcelas do tomador. Entra por proposta (`consultarPorProposta`) ou direto por
// contrato (`consultarPorId`); apos a primeira resposta usa `contrato.id` como identidade da
// jornada. A agenda so e consultada quando o contrato esta ASSINADO (o backend so gera agenda
// pos-assinatura) — contrato nao assinado nao dispara chamada de agenda. Composicao, ordenacao,
// valores e status vem prontos do backend; o app nunca recalcula saldo, juros, mora, dias de atraso
// ou status, nem persiste a agenda. 404 e tratado como "parcelas ainda indisponiveis" (com retry),
// nunca como lista vazia; 403 mostra mensagem neutra sem revelar existencia de agenda alheia.
@Component({
  selector: 'sep-agenda-detail',
  standalone: true,
  imports: [IonContent, IonSpinner, HeaderMobileComponent, ParcelaStatusComponent],
  templateUrl: './agenda-detail.component.html',
  styleUrl: './agenda-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgendaDetailComponent implements OnInit {
  private readonly contratos = inject(ContratosMobileService);
  private readonly cobranca = inject(CobrancaMobileService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly agenda = signal<AgendaPagamentoResponse | null>(null);
  readonly carregando = signal(true);
  // Erro real (403 neutro, rede/5xx): bloqueia a agenda e oferece retry.
  readonly erro = signal<string | null>(null);
  // "Soft": contrato ainda nao assinado ou agenda nao gerada (404). Distinto de erro real; tambem
  // oferece retry porque a agenda pode surgir em instantes.
  readonly indisponivel = signal<string | null>(null);

  private propostaId = '';
  private contratoId = '';

  async ngOnInit(): Promise<void> {
    this.propostaId = this.route.snapshot.paramMap.get('propostaId') ?? '';
    this.contratoId = this.route.snapshot.paramMap.get('contratoId') ?? '';
    await this.carregar();
  }

  async carregar(): Promise<void> {
    this.carregando.set(true);
    this.erro.set(null);
    this.indisponivel.set(null);
    this.agenda.set(null);
    try {
      const contrato = this.contratoId
        ? await this.contratos.consultarPorId(this.contratoId)
        : await this.contratos.consultarPorProposta(this.propostaId);
      this.contratoId = contrato.id;
      // Agenda so existe apos a assinatura. Sem ASSINADO, nao consulta a agenda (evita chamada
      // indevida) e informa que as parcelas ainda nao estao disponiveis.
      if (contrato.status !== 'ASSINADO') {
        this.indisponivel.set(
          'As parcelas aparecem apos a assinatura do contrato e a geracao da agenda.',
        );
        return;
      }
      this.agenda.set(await this.cobranca.consultarAgenda(contrato.id));
    } catch (err) {
      this.tratarErro(err);
    } finally {
      this.carregando.set(false);
    }
  }

  abrirParcela(parcelaId: string): void {
    void this.router.navigate(['/app/parcelas/contratos', this.contratoId, 'parcelas', parcelaId]);
  }

  protected valorFormatado(valor: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
  }

  // dataVencimento e LocalDate (yyyy-MM-dd). Fixa meio-dia local para exibir a data recebida sem
  // deslocamento de fuso. Formatacao e apenas apresentacao; nenhuma aritmetica de data ocorre aqui.
  protected dataVencimentoFormatada(data: string): string {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(`${data}T12:00:00`));
  }

  protected dataGeracaoFormatada(iso: string): string {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(iso));
  }

  private tratarErro(err: unknown): void {
    if (err instanceof HttpErrorResponse) {
      // 404: contrato/agenda ainda nao gerados. Indisponivel com retry, nunca lista vazia.
      if (err.status === 404) {
        this.indisponivel.set('Parcelas ainda indisponiveis. Tente novamente em instantes.');
        return;
      }
      // 403: ownership/role. Mensagem neutra para nao revelar existencia de agenda alheia.
      if (err.status === 403) {
        this.erro.set('Voce nao tem acesso a estas parcelas.');
        return;
      }
    }
    this.erro.set('Nao foi possivel carregar as parcelas. Tente novamente.');
  }
}
