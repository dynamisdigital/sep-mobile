import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
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

import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'sep-login',
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
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toastCtrl = inject(ToastController);

  readonly submitting = signal(false);

  readonly form = this.fb.nonNullable.group({
    username: ['', [Validators.required, Validators.email]],
    // M-Sprint 5: politica server-side (PasswordPolicy 12+ chars OU passphrase).
    password: ['', [Validators.required]],
  });

  async submit(): Promise<void> {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    try {
      const response = await this.auth.login(this.form.getRawValue());
      if (response.mfaRequired) {
        await this.router.navigateByUrl('/login/verify-totp');
        return;
      }
      if (response.usuario?.precisaRedefinirSenha) {
        await this.router.navigateByUrl('/app/perfil/alterar-senha?forced=true');
        return;
      }
      await this.router.navigateByUrl('/app/inicio');
    } catch (error) {
      const status = error instanceof HttpErrorResponse ? error.status : 0;
      let message = 'Falha ao autenticar. Tente novamente.';
      if (status === 401) {
        message = 'Credenciais invalidas';
      } else if (status === 423) {
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
}
