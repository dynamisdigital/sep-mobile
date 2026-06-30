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
import { IonButton, IonContent, IonSpinner } from '@ionic/angular/standalone';

import {
  ApiErrorResponse,
  ContratoResponse,
  StatusAssinaturaResponse,
  StatusFormalizacao,
  TipoContrato,
  VersaoContratoResponse,
} from '../../../core/api/api.models';
import { AuthService } from '../../../core/auth/auth.service';
import { StepUpTokenStore } from '../../../core/auth/step-up-token.store';
import { ContratosMobileService } from '../../../core/contratos/contratos-mobile.service';
import { HeaderMobileComponent } from '../../../layout/header-mobile/header-mobile.component';
import { ContratoContentComponent } from './contrato-content.component';

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
// Aceite so vale para a versao vigente em AGUARDANDO_ACEITE, exige confirmacao explicita e step-up
// (sem bypass pelo mobile); documento/assinatura (M-8.5) chegam depois. IDs internos, dados de
// aceite e envelope externo nao sao exibidos.
@Component({
  selector: 'sep-contrato-detail',
  standalone: true,
  imports: [IonContent, IonButton, IonSpinner, HeaderMobileComponent, ContratoContentComponent],
  templateUrl: './contrato-detail.component.html',
  styleUrl: './contrato-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContratoDetailComponent implements OnInit {
  private readonly contratos = inject(ContratosMobileService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly stepUpStore = inject(StepUpTokenStore);

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

  readonly confirmacaoAberta = signal(false);
  readonly aceitando = signal(false);
  readonly erroAceite = signal<string | null>(null);
  readonly statusAssinatura = signal<StatusAssinaturaResponse | null>(null);

  // Aceite so e oferecido para a versao vigente em AGUARDANDO_ACEITE e ao titular CLIENTE. Versao
  // historica nunca habilita aceite. Ownership real e validado pelo backend.
  readonly podeAceitar = computed<boolean>(() => {
    const contrato = this.contrato();
    return (
      !!contrato &&
      contrato.status === 'AGUARDANDO_ACEITE' &&
      this.exibindoVigente() &&
      this.auth.currentUser()?.role === 'CLIENTE'
    );
  });

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
    this.resetarAceite();
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
    // Sair da versao vigente fecha qualquer confirmacao de aceite em aberto: versao historica
    // nunca pode ser aceita.
    this.confirmacaoAberta.set(false);
    this.versaoSelecionadaId.set(id);
  }

  voltarParaVigente(): void {
    this.hashCopiado.set(false);
    this.versaoSelecionadaId.set(null);
  }

  abrirConfirmacao(): void {
    if (!this.podeAceitar()) {
      return;
    }
    this.erroAceite.set(null);
    this.confirmacaoAberta.set(true);
  }

  cancelarConfirmacao(): void {
    this.confirmacaoAberta.set(false);
  }

  // Registra o aceite da versao vigente. Exige MFA habilitado e step-up: sem token o usuario e
  // levado a verificacao e, ao voltar, precisa tocar novamente (nenhum aceite automatico). Sem MFA,
  // o mobile bloqueia em vez de usar o bypass legado do backend.
  async confirmarAceite(): Promise<void> {
    if (this.aceitando()) {
      return;
    }
    const user = this.auth.currentUser();
    if (!user || !this.podeAceitar()) {
      return;
    }
    if (!user.mfaHabilitado) {
      this.confirmacaoAberta.set(false);
      this.erroAceite.set('Para aceitar, ative a verificacao em duas etapas (MFA) no seu perfil.');
      return;
    }
    if (!this.stepUpStore.hasToken()) {
      this.confirmacaoAberta.set(false);
      this.irParaStepUp();
      return;
    }

    this.aceitando.set(true);
    this.erroAceite.set(null);
    try {
      const atualizado = await this.contratos.registrarAceite(this.contratoId);
      this.contrato.set(atualizado);
      this.versaoSelecionadaId.set(null);
      this.confirmacaoAberta.set(false);
      await this.consultarStatusAssinatura();
    } catch (err) {
      await this.tratarErroAceite(err);
    } finally {
      this.aceitando.set(false);
    }
  }

  async consultarStatusAssinatura(): Promise<void> {
    try {
      this.statusAssinatura.set(await this.contratos.consultarStatusAssinatura(this.contratoId));
    } catch {
      // Status e complementar; sua falha nao invalida o aceite ja registrado. Detalhe em M-8.5.
      this.statusAssinatura.set(null);
    }
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

  private irParaStepUp(): void {
    void this.router.navigateByUrl(
      `/app/step-up?next=/app/formalizacao/contratos/${this.contratoId}`,
    );
  }

  private async tratarErroAceite(err: unknown): Promise<void> {
    if (err instanceof HttpErrorResponse) {
      // 403 por step-up ausente/expirado: limpa o token e oferece nova verificacao.
      if (err.status === 403 && this.isStepUpRequiredError(err)) {
        this.stepUpStore.clear();
        this.confirmacaoAberta.set(false);
        this.irParaStepUp();
        return;
      }
      // 403 de ownership/role: acesso negado, sem loop de step-up.
      if (err.status === 403) {
        this.erroAceite.set('Voce nao tem permissao para aceitar este contrato.');
        return;
      }
      if (err.status === 404) {
        this.erroAceite.set('Contrato nao encontrado.');
        return;
      }
      // 409: versao/estado mudou. Recarrega e exige nova leitura antes de tentar de novo.
      if (err.status === 409) {
        await this.carregar();
        this.erroAceite.set(
          'A versao do contrato mudou. Releia a versao vigente antes de aceitar.',
        );
        return;
      }
    }
    // Rede/5xx: nao assumir aceite. Recarrega para refletir o estado real antes de nova tentativa.
    await this.carregar();
    this.erroAceite.set('Nao foi possivel registrar o aceite. Tente novamente.');
  }

  private isStepUpRequiredError(err: HttpErrorResponse): boolean {
    const message = ((err.error as ApiErrorResponse | null | undefined)?.message ?? '')
      .toString()
      .toLowerCase();
    return message.includes('step-up') || message.includes('step_up');
  }

  private resetarHistorico(): void {
    this.versoes.set([]);
    this.historicoAberto.set(false);
    this.carregandoVersoes.set(false);
    this.erroVersoes.set(null);
    this.versaoSelecionadaId.set(null);
    this.hashCopiado.set(false);
  }

  private resetarAceite(): void {
    this.confirmacaoAberta.set(false);
    this.aceitando.set(false);
    this.erroAceite.set(null);
    this.statusAssinatura.set(null);
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
