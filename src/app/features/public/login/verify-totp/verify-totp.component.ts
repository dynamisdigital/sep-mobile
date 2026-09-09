import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonInput,
  IonNote,
  IonSpinner,
  IonText,
  ToastController,
} from '@ionic/angular/standalone';

import { codigoDeErroDaApi, mensagemDaApi } from '../../../../core/api/api-error';
import { AuthService } from '../../../../core/auth/auth.service';
import { BiometricService } from '../../../../core/auth/biometric.service';
import { MfaService } from '../../../../core/auth/mfa.service';

/**
 * Os dois codigos do `400` em que **redigitar e impossivel**, e por isso manter o formulario de pe
 * transforma a tela numa armadilha:
 *
 * - `MFA-400-004` (`MfaChallengeInvalidoException`) — o desafio morreu. Nenhum codigo o revive.
 * - `MFA-400-003` (`MfaNaoHabilitadoException`) — a conta nao tem TOTP ativo. Nao ha codigo certo
 *   a digitar.
 *
 * `MFA-400-002` (`TotpInvalidoException`) fica **de fora**, de proposito: ali o `VerificarTotpUseCase`
 * chama `challengeService.devolver(...)` antes de lancar, o desafio segue vivo e tentar de novo e
 * exatamente o que a pessoa deve fazer.
 *
 * Ate a M-Sprint 18 os tres caiam no mesmo lugar — toast de 3 segundos, formulario de pe — e quem
 * chegava aqui com desafio expirado redigitava contra um challenge morto ate desistir.
 *
 * E um conjunto de RAMO, nao de copy: nenhuma frase mora nele.
 */
const CODIGOS_DE_DESFECHO_TERMINAL = new Set(['MFA-400-003', 'MFA-400-004']);

const FALLBACK_ERRO_TOTP = 'Codigo invalido ou challenge expirado.';
const FALLBACK_ERRO_TERMINAL = 'Este desafio nao pode mais ser usado. Refaca o login.';

/**
 * So o `400` consulta o codigo. Os demais status ja tem tratamento proprio e nao ganham ramo novo:
 * o `423` navega para `/account-locked` desde a M-Sprint 5, e os codigos de `401`/`403`/`429` ficaram
 * **fora** do perimetro da Sprint 36 porque vem da cadeia de seguranca, que escreve na response sem
 * passar pelo `@RestControllerAdvice`.
 *
 * Codigo ausente, desconhecido ou nao-string devolve `false` e o comportamento legado por status
 * permanece: cobre backend anterior a Sprint 36, os handlers ainda sem taxonomia, o `@NotBlank` da
 * fronteira (que responde SEM `codigo`) e o que a Sprint 37 vier a criar.
 */
function ehDesfechoTerminal(erro: unknown): boolean {
  if (!(erro instanceof HttpErrorResponse) || erro.status !== 400) {
    return false;
  }
  const codigo = codigoDeErroDaApi(erro);
  return codigo !== undefined && CODIGOS_DE_DESFECHO_TERMINAL.has(codigo);
}

@Component({
  selector: 'sep-verify-totp',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    IonContent,
    IonInput,
    IonNote,
    IonButton,
    IonText,
    IonSpinner,
  ],
  templateUrl: './verify-totp.component.html',
  styleUrls: ['./verify-totp.component.scss'],
})
export class VerifyTotpComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly mfa = inject(MfaService);
  private readonly biometric = inject(BiometricService);
  private readonly router = inject(Router);
  private readonly toastCtrl = inject(ToastController);

  readonly submitting = signal(false);
  readonly biometriaDisponivel = signal(false);
  readonly challengeAusente = signal(false);
  /**
   * Texto do bloco terminal quando quem o fechou foi o backend, e nao a ausencia local de desafio.
   *
   * `null` preserva a copy fixa "Sessao expirada" do template, que continua correta para o ramo
   * "nao ha challenge pendente". Reaproveitar aquele texto para conta sem MFA (`MFA-400-003`) diria
   * ao usuario para refazer o login em busca de um desafio que a conta dele nunca vai emitir.
   *
   * Signal proprio, e nao um toast: um toast de 3 segundos desaparece e deixa o usuario diante de
   * um formulario encerrado sem explicacao na tela.
   */
  readonly mensagemTerminal = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    codigo: ['', [Validators.required]],
  });

  async ngOnInit(): Promise<void> {
    await this.auth.hydratePendingMfa();
    if (!this.auth.pendingMfaChallenge()) {
      this.challengeAusente.set(true);
      return;
    }
    this.biometriaDisponivel.set(await this.biometric.checkAvailability());
  }

  async submit(): Promise<void> {
    // `challengeAusente` barra o envio, nao so esconde o formulario: o template deixa de renderizar
    // o `<form>`, mas `submit()` continua alcancavel por chamada programatica e por um Enter numa
    // referencia retida. Sem esta guarda o app repetiria a chamada contra um desafio ja morto.
    if (this.challengeAusente() || this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }
    const challengeId = this.auth.pendingMfaChallenge();
    if (!challengeId) {
      this.challengeAusente.set(true);
      return;
    }
    this.submitting.set(true);
    try {
      const response = await this.mfa.verify({
        mfaChallengeId: challengeId,
        codigo: this.form.controls.codigo.value,
      });
      await this.auth.applyMfaVerifyResponse(response);
      if (response.usuario?.precisaRedefinirSenha) {
        await this.router.navigateByUrl('/app/perfil/alterar-senha?forced=true');
        return;
      }
      await this.router.navigateByUrl('/app/inicio');
    } catch (error) {
      const status = error instanceof HttpErrorResponse ? error.status : 0;
      // O 423 continua sendo do interceptor + desta navegacao, como desde a M-Sprint 5. O codigo
      // `AUTH-423-001` existe e e publicado, mas ramificar por ele aqui nao mudaria acao nenhuma —
      // seria consumidor decorativo.
      if (status === 423) {
        await this.router.navigateByUrl('/account-locked');
        return;
      }
      // A frase e a mesma dos dois lados; o codigo escolhe ONDE ela aparece, nao QUAL ela e.
      if (ehDesfechoTerminal(error)) {
        this.mensagemTerminal.set(mensagemDaApi(error) ?? FALLBACK_ERRO_TERMINAL);
        this.challengeAusente.set(true);
        // O desafio guardado ficou inutilizavel nos dois codigos terminais. Sem descarta-lo, o
        // `hydratePendingMfa` de uma reentrada o traria de volta do storage e a tela ofereceria o
        // formulario outra vez. Operacao especifica: nao ha sessao a derrubar aqui.
        await this.auth.descartarDesafioMfa();
        return;
      }
      const toast = await this.toastCtrl.create({
        message: mensagemDaApi(error) ?? FALLBACK_ERRO_TOTP,
        duration: 3000,
        color: 'danger',
        position: 'top',
      });
      await toast.present();
    } finally {
      this.submitting.set(false);
    }
  }

  async tentarBiometria(): Promise<void> {
    // Mesma razao da guarda em `submit()`: o botao some do template, o metodo nao. Depois de um
    // desfecho terminal nao ha desafio a confirmar, e prometer biometria seria oferecer um caminho
    // que nao existe.
    if (this.challengeAusente()) {
      return;
    }
    const ok = await this.biometric.authenticate(
      'Confirme sua identidade para concluir o login no SEP.',
    );
    if (!ok) {
      const toast = await this.toastCtrl.create({
        message: 'Biometria indisponivel; use o codigo TOTP.',
        duration: 2500,
        position: 'top',
      });
      await toast.present();
      return;
    }
    // Quando biometria nativa estiver ativa em fase posterior, ela ja vai resolver
    // o challenge no backend via uma rota dedicada (futuro). Por ora, biometria
    // apenas confirma intencao localmente — usuario ainda digita codigo.
  }
}
