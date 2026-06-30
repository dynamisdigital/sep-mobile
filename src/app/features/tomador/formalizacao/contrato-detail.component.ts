import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { IonButton, IonContent, IonSpinner } from '@ionic/angular/standalone';

import { ContratoResponse, StatusFormalizacao, TipoContrato } from '../../../core/api/api.models';
import { ContratosMobileService } from '../../../core/contratos/contratos-mobile.service';
import { HeaderMobileComponent } from '../../../layout/header-mobile/header-mobile.component';

const ROTULOS_TIPO: Record<TipoContrato, string> = {
  MUTUO: 'Contrato de mutuo',
  CCB: 'CCB',
  OUTROS: 'Contrato',
};

const ROTULOS_STATUS: Record<StatusFormalizacao, string> = {
  GERADO: 'Gerado',
  AGUARDANDO_ACEITE: 'Aguardando aceite',
  ACEITO: 'Aceito',
  EM_ASSINATURA: 'Em assinatura',
  ASSINADO: 'Assinado',
  RECUSADO: 'Recusado',
  CANCELADO: 'Cancelado',
};

// Detalhe do contrato de formalizacao. Entra por proposta (`consultarPorProposta`) ou direto por
// contrato (`consultarPorId`); apos a primeira resposta usa `contrato.id` como identidade. Apresenta
// tipo, status, datas e resumo da versao vigente. Ownership, versionamento e validade ficam no
// backend. Leitura completa de conteudo/clausulas (M-8.3), aceite (M-8.4) e assinatura/documento
// (M-8.5) chegam nas tasks seguintes. IDs internos, dados de aceite e envelope externo nao sao
// exibidos.
@Component({
  selector: 'sep-contrato-detail',
  standalone: true,
  imports: [IonContent, IonButton, IonSpinner, HeaderMobileComponent],
  templateUrl: './contrato-detail.component.html',
  styleUrl: './contrato-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContratoDetailComponent implements OnInit {
  private readonly contratos = inject(ContratosMobileService);
  private readonly route = inject(ActivatedRoute);

  readonly contrato = signal<ContratoResponse | null>(null);
  readonly carregando = signal(true);
  readonly erro = signal<string | null>(null);

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
    try {
      const contrato = this.contratoId
        ? await this.contratos.consultarPorId(this.contratoId)
        : await this.contratos.consultarPorProposta(this.propostaId);
      // Identidade das proximas operacoes vem sempre do contrato resolvido, nunca da proposta.
      this.contratoId = contrato.id;
      this.contrato.set(contrato);
    } catch (err) {
      this.contrato.set(null);
      this.erro.set(this.mensagemErro(err));
    } finally {
      this.carregando.set(false);
    }
  }

  protected rotuloTipo(tipo: TipoContrato): string {
    return ROTULOS_TIPO[tipo];
  }

  protected rotuloStatus(status: StatusFormalizacao): string {
    return ROTULOS_STATUS[status];
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
      // 404: proposta aprovada ainda sem contrato gerado, ou id inexistente. O mobile nao gera
      // contrato; oferece nova tentativa.
      if (err.status === 404) {
        return 'Contrato ainda indisponivel. Tente novamente em instantes.';
      }
      // 403: ownership/role. Mensagem neutra para nao revelar existencia de contrato alheio.
      if (err.status === 403) {
        return 'Voce nao tem acesso a este contrato.';
      }
    }
    return 'Nao foi possivel carregar o contrato. Tente novamente.';
  }
}
