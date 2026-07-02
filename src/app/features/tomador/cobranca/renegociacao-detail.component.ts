import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { IonContent, IonSpinner } from '@ionic/angular/standalone';

import { ApiErrorResponse, RenegociacaoTomadorResponse } from '../../../core/api/api.models';
import { AuthService } from '../../../core/auth/auth.service';
import { StepUpTokenStore } from '../../../core/auth/step-up-token.store';
import { CobrancaMobileService } from '../../../core/cobranca/cobranca-mobile.service';
import { HeaderMobileComponent } from '../../../layout/header-mobile/header-mobile.component';

// Termos e decisao da renegociacao ativa da parcela (M-9.5, backend B2/Sprint 24 + PATCHes da
// Sprint 13). O app exibe os termos exatamente como recebidos — `valorTotalRenegociado` vem do
// backend e NUNCA e derivado de `valor x quantidade` localmente. A proposta e reconsultada ao
// entrar e imediatamente antes de abrir cada confirmacao, evitando decisao sobre snapshot
// expirado. Aceite exige confirmacao explicita + MFA habilitado + step-up de uso unico (sem
// bypass); o retorno do step-up apenas recarrega os termos — um novo toque e obrigatorio, nunca
// ha aceite automatico. Recusa e explicita e nao inicia nem consome step-up. Erros nunca viram
// sucesso presumido: 409/404 recarregam os termos; rede/5xx mantem a tela para nova tentativa.
// Nada e persistido localmente; IDs internos e dados do operador nao existem no contrato B2.
@Component({
  selector: 'sep-renegociacao-detail',
  standalone: true,
  imports: [IonContent, IonSpinner, HeaderMobileComponent],
  templateUrl: './renegociacao-detail.component.html',
  styleUrl: './renegociacao-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RenegociacaoDetailComponent implements OnInit {
  private readonly cobranca = inject(CobrancaMobileService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly stepUpStore = inject(StepUpTokenStore);

  readonly renegociacao = signal<RenegociacaoTomadorResponse | null>(null);
  readonly carregando = signal(true);
  readonly erro = signal<string | null>(null);
  // Proposta propria sem renegociacao ativa (404): mensagem propria com retorno a parcela.
  readonly indisponivel = signal(false);

  readonly confirmacaoAceiteAberta = signal(false);
  readonly confirmacaoRecusaAberta = signal(false);
  readonly decidindo = signal(false);
  readonly erroDecisao = signal<string | null>(null);

  private contratoId = '';
  private parcelaId = '';

  async ngOnInit(): Promise<void> {
    this.contratoId = this.route.snapshot.paramMap.get('contratoId') ?? '';
    this.parcelaId = this.route.snapshot.paramMap.get('parcelaId') ?? '';
    await this.carregar();
  }

  async carregar(): Promise<void> {
    this.carregando.set(true);
    this.erro.set(null);
    this.indisponivel.set(false);
    this.fecharConfirmacoes();
    try {
      this.renegociacao.set(await this.cobranca.consultarRenegociacaoAtiva(this.parcelaId));
    } catch (err) {
      this.renegociacao.set(null);
      this.tratarErroCarga(err);
    } finally {
      this.carregando.set(false);
    }
  }

  // Reconsulta os termos imediatamente antes de abrir a confirmacao: a decisao nunca acontece
  // sobre snapshot velho. Se a proposta sumiu/expirou nesse meio tempo, a tela reflete o 404.
  async abrirConfirmacaoAceite(): Promise<void> {
    if (this.decidindo()) {
      return;
    }
    this.erroDecisao.set(null);
    await this.carregar();
    if (this.renegociacao()) {
      this.confirmacaoAceiteAberta.set(true);
    }
  }

  async abrirConfirmacaoRecusa(): Promise<void> {
    if (this.decidindo()) {
      return;
    }
    this.erroDecisao.set(null);
    await this.carregar();
    if (this.renegociacao()) {
      this.confirmacaoRecusaAberta.set(true);
    }
  }

  cancelarConfirmacao(): void {
    this.fecharConfirmacoes();
  }

  // Aceite: MFA habilitado + step-up de uso unico. Sem token o usuario vai a verificacao e, ao
  // voltar, os termos recarregam e um novo toque e exigido (nenhum aceite automatico). O token e
  // anexado/consumido pelo stepUpInterceptor no PATCH.
  async confirmarAceite(): Promise<void> {
    if (this.decidindo()) {
      return;
    }
    const renegociacao = this.renegociacao();
    const user = this.auth.currentUser();
    if (!renegociacao || !user) {
      return;
    }
    if (!user.mfaHabilitado) {
      this.fecharConfirmacoes();
      this.erroDecisao.set('Para aceitar, ative a verificacao em duas etapas (MFA) no seu perfil.');
      return;
    }
    if (!this.stepUpStore.hasToken()) {
      this.fecharConfirmacoes();
      this.irParaStepUp();
      return;
    }

    this.decidindo.set(true);
    this.erroDecisao.set(null);
    try {
      await this.cobranca.aceitarRenegociacao(renegociacao.renegociacaoId);
      // Aceite cria agenda substituta: volta para a agenda ativa do contrato (recarregada la).
      this.fecharConfirmacoes();
      void this.router.navigate(['/app/parcelas/contratos', this.contratoId]);
    } catch (err) {
      await this.tratarErroDecisao(err, true);
    } finally {
      this.decidindo.set(false);
    }
  }

  // Recusa explicita: nao inicia step-up e nao consome token.
  async confirmarRecusa(): Promise<void> {
    if (this.decidindo()) {
      return;
    }
    const renegociacao = this.renegociacao();
    if (!renegociacao) {
      return;
    }
    this.decidindo.set(true);
    this.erroDecisao.set(null);
    try {
      await this.cobranca.recusarRenegociacao(renegociacao.renegociacaoId);
      // Parcela volta ao status anterior: retorna ao detalhe recarregado.
      this.fecharConfirmacoes();
      this.voltarParaParcela();
    } catch (err) {
      await this.tratarErroDecisao(err, false);
    } finally {
      this.decidindo.set(false);
    }
  }

  voltarParaParcela(): void {
    void this.router.navigate([
      '/app/parcelas/contratos',
      this.contratoId,
      'parcelas',
      this.parcelaId,
    ]);
  }

  protected valorFormatado(valor: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
  }

  // novoVencimento e LocalDate (yyyy-MM-dd); fixa meio-dia local para nao deslocar fuso.
  protected dataFormatada(data: string): string {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(`${data}T12:00:00`));
  }

  // dataProposta/dataExpiracao sao ISO-8601 com offset; exibe data e hora locais.
  protected dataHoraFormatada(data: string): string {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(data));
  }

  private fecharConfirmacoes(): void {
    this.confirmacaoAceiteAberta.set(false);
    this.confirmacaoRecusaAberta.set(false);
  }

  private irParaStepUp(): void {
    void this.router.navigateByUrl(
      `/app/step-up?next=/app/parcelas/contratos/${this.contratoId}/parcelas/${this.parcelaId}/renegociacao`,
    );
  }

  private tratarErroCarga(err: unknown): void {
    if (err instanceof HttpErrorResponse) {
      // 404: sem proposta ativa (inexistente, decidida ou expirada pelo Clock do backend).
      if (err.status === 404) {
        this.indisponivel.set(true);
        return;
      }
      // 403: ownership. Mensagem neutra, sem diferenciar parcela alheia de inexistente.
      if (err.status === 403) {
        this.erro.set('Voce nao tem acesso a esta renegociacao.');
        return;
      }
    }
    this.erro.set('Nao foi possivel carregar a renegociacao. Tente novamente.');
  }

  private async tratarErroDecisao(err: unknown, aceite: boolean): Promise<void> {
    this.fecharConfirmacoes();
    if (err instanceof HttpErrorResponse) {
      // 403 por step-up ausente/expirado (so no aceite): limpa o token e reinicia a verificacao.
      if (aceite && err.status === 403 && this.isStepUpRequiredError(err)) {
        this.stepUpStore.clear();
        this.irParaStepUp();
        return;
      }
      // 403 de ownership/role: acesso negado, sem loop de step-up.
      if (err.status === 403) {
        this.erroDecisao.set('Voce nao tem permissao para decidir esta renegociacao.');
        return;
      }
      // 404/409: proposta decidida em paralelo ou expirada. Recarrega os termos para refletir o
      // estado real; a tela de indisponibilidade orienta o retorno a parcela.
      if (err.status === 404 || err.status === 409) {
        await this.carregar();
        this.erroDecisao.set('A proposta mudou ou expirou. Confira o estado atual.');
        return;
      }
    }
    // Rede/5xx: nunca assumir decisao registrada. Recarrega para refletir o estado real.
    await this.carregar();
    this.erroDecisao.set('Nao foi possivel concluir. Verifique o estado e tente novamente.');
  }

  private isStepUpRequiredError(err: HttpErrorResponse): boolean {
    const message = ((err.error as ApiErrorResponse | null | undefined)?.message ?? '')
      .toString()
      .toLowerCase();
    return message.includes('step-up') || message.includes('step_up');
  }
}
