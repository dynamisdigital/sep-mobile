import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonInput,
  IonNote,
  IonSpinner,
  IonText,
  IonTitle,
  IonToolbar,
  ToastController,
} from '@ionic/angular/standalone';

import { AuthService } from '../../../../core/auth/auth.service';
import { BiometricService } from '../../../../core/auth/biometric.service';
import { MfaService } from '../../../../core/auth/mfa.service';

@Component({
  selector: 'sep-verify-totp',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    IonHeader,
    IonToolbar,
    IonTitle,
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
    if (this.form.invalid || this.submitting()) {
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
      const message = 'Codigo invalido ou challenge expirado.';
      if (status === 423) {
        await this.router.navigateByUrl('/account-locked');
        return;
      }
      const toast = await this.toastCtrl.create({
        message,
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
