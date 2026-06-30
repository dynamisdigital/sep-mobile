import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { IonButton, IonContent, IonSpinner } from '@ionic/angular/standalone';

import {
  ContratoResponse,
  StatusFormalizacao,
  TipoContrato,
  VersaoContratoResponse,
} from '../../../core/api/api.models';
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

// Detalhe e leitura do contrato de formalizacao. Entra por proposta (`consultarPorProposta`) ou
// direto por contrato (`consultarPorId`); apos a primeira resposta usa `contrato.id` como
// identidade. Apresenta tipo, status, datas, a versao vigente (texto + clausulas + hash) e um
// historico somente leitura. Conteudo e renderizado como texto puro (interpolacao), nunca HTML;
// o hash nao e recalculado nem validado. Ownership, versionamento e validade ficam no backend.
// Aceite (M-8.4) so vale para a versao vigente; documento/assinatura (M-8.5) chegam depois. IDs
// internos, dados de aceite e envelope externo nao sao exibidos.
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

  readonly versoes = signal<VersaoContratoResponse[]>([]);
  readonly historicoAberto = signal(false);
  readonly carregandoVersoes = signal(false);
  readonly erroVersoes = signal<string | null>(null);
  // null = exibindo a versao vigente embutida no contrato.
  readonly versaoSelecionadaId = signal<string | null>(null);
  readonly hashCopiado = signal(false);

  // Versao mostrada na leitura: a selecionada no historico ou, por padrao, a vigente embutida no
  // contrato. Se a selecao nao estiver no historico carregado, cai para a vigente.
  readonly versaoExibida = computed<VersaoContratoResponse | null>(() => {
    const contrato = this.contrato();
    if (!contrato) {
      return null;
    }
    const selecionadaId = this.versaoSelecionadaId();
    if (!selecionadaId) {
      return contrato.versaoVigente;
    }
    return this.versoes().find((v) => v.id === selecionadaId) ?? contrato.versaoVigente;
  });

  // A versao exibida e a vigente? Define o badge e, na M-8.4, a permissao de aceite (versao
  // historica nunca pode ser aceita).
  readonly exibindoVigente = computed<boolean>(() => {
    const vigente = this.contrato()?.versaoVigente ?? null;
    const exibida = this.versaoExibida();
    return !!vigente && !!exibida && vigente.id === exibida.id;
  });

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
    this.resetarHistorico();
    try {
      const contrato = this.contratoId
        ? await this.contratos.consultarPorId(this.contratoId)
        : await this.contratos.consultarPorProposta(this.propostaId);
      this.contratoId = contrato.id;
      this.contrato.set(contrato);
    } catch (err) {
      this.contrato.set(null);
      this.erro.set(this.mensagemErro(err));
    } finally {
      this.carregando.set(false);
    }
  }

  async abrirHistorico(): Promise<void> {
    this.historicoAberto.set(true);
    if (this.versoes().length > 0 || this.carregandoVersoes()) {
      return;
    }
    await this.carregarVersoes();
  }

  async carregarVersoes(): Promise<void> {
    const contrato = this.contrato();
    if (!contrato) {
      return;
    }
    this.carregandoVersoes.set(true);
    this.erroVersoes.set(null);
    try {
      // Ordem ascendente preservada conforme recebida do backend.
      this.versoes.set(await this.contratos.listarVersoes(contrato.id));
    } catch {
      this.erroVersoes.set(
        'Nao foi possivel carregar o historico. A versao vigente continua disponivel.',
      );
    } finally {
      this.carregandoVersoes.set(false);
    }
  }

  selecionarVersao(id: string): void {
    this.hashCopiado.set(false);
    this.versaoSelecionadaId.set(id);
  }

  voltarParaVigente(): void {
    this.hashCopiado.set(false);
    this.versaoSelecionadaId.set(null);
  }

  async copiarHash(hash: string): Promise<void> {
    if (!navigator.clipboard) {
      return;
    }
    // Clipboard pode ser negada (permissao/contexto inseguro). Falha nao bloqueia a leitura: o
    // hash continua visivel e selecionavel; apenas nao marcamos "Copiado".
    try {
      await navigator.clipboard.writeText(hash);
      this.hashCopiado.set(true);
    } catch {
      this.hashCopiado.set(false);
    }
  }

  protected ehVigente(versao: VersaoContratoResponse): boolean {
    return this.contrato()?.versaoVigente?.id === versao.id;
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

  private resetarHistorico(): void {
    this.versoes.set([]);
    this.historicoAberto.set(false);
    this.carregandoVersoes.set(false);
    this.erroVersoes.set(null);
    this.versaoSelecionadaId.set(null);
    this.hashCopiado.set(false);
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
