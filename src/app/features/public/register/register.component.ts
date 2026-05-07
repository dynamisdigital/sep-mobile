import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonInput,
  IonNote,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonText,
  ToastController,
} from '@ionic/angular/standalone';

import { UsuarioRole } from '../../../core/api/api.models';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'sep-register',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    IonContent,
    IonInput,
    IonNote,
    IonSelect,
    IonSelectOption,
    IonButton,
    IonText,
    IonSpinner,
  ],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss'],
})
export class RegisterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toastCtrl = inject(ToastController);

  readonly submitting = signal(false);

  readonly form = this.fb.nonNullable.group({
    username: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(6)]],
    role: ['CLIENTE' as UsuarioRole, [Validators.required]],
  });

  async submit(): Promise<void> {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    try {
      await this.auth.register(this.form.getRawValue());
      const successToast = await this.toastCtrl.create({
        message: 'Cadastro concluido. Faca login para continuar.',
        duration: 2500,
        color: 'success',
        position: 'top',
      });
      await successToast.present();
      await this.router.navigateByUrl('/login');
    } catch (error) {
      const status = error instanceof HttpErrorResponse ? error.status : 0;
      let message = 'Falha ao cadastrar. Tente novamente.';
      if (status === 409) message = 'E-mail ja cadastrado';
      else if (status === 400) message = 'Dados invalidos. Revise os campos.';
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
