import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';

import { ApiErrorResponse } from '../../../../core/api/api.models';
import { AuthService } from '../../../../core/auth/auth.service';
import { UsuariosService } from '../../../../core/users/usuarios.service';
import { HeaderMobileComponent } from '../../../../layout/header-mobile/header-mobile.component';

const confirmacaoIgualValidator = (group: AbstractControl): ValidationErrors | null => {
  const nova = group.get('novaSenha')?.value;
  const confirmacao = group.get('confirmacaoNovaSenha')?.value;
  if (!nova || !confirmacao) {
    return null;
  }
  return nova === confirmacao ? null : { confirmacaoDiferente: true };
};

@Component({
  selector: 'sep-change-password',
  standalone: true,
  imports: [IonContent, ReactiveFormsModule, RouterLink, HeaderMobileComponent],
  templateUrl: './change-password.component.html',
  styleUrl: './change-password.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChangePasswordComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly usuarios = inject(UsuariosService);
  private readonly router = inject(Router);

  readonly submitting = signal(false);
  readonly successMessage = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group(
    {
      passwordAtual: ['', [Validators.required]],
      novaSenha: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(6)]],
      confirmacaoNovaSenha: ['', [Validators.required]],
    },
    { validators: confirmacaoIgualValidator },
  );

  async submit(): Promise<void> {
    if (this.submitting()) {
      return;
    }
    const user = this.auth.currentUser();
    if (!user || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.successMessage.set(null);
    this.errorMessage.set(null);

    try {
      await this.usuarios.alterarSenha(user.id, {
        passwordAtual: this.form.controls.passwordAtual.value,
        novaSenha: this.form.controls.novaSenha.value,
      });
      this.successMessage.set('Senha alterada com sucesso.');
      this.form.reset({ passwordAtual: '', novaSenha: '', confirmacaoNovaSenha: '' });
    } catch (error) {
      this.errorMessage.set(this.extractMessage(error));
    } finally {
      this.submitting.set(false);
    }
  }

  cancel(): void {
    void this.router.navigateByUrl('/app/perfil');
  }

  private extractMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const body = error.error as ApiErrorResponse | null | undefined;
      if (body?.message) {
        return body.message;
      }
      if (error.status === 400) {
        return 'Senha atual incorreta ou nova senha invalida.';
      }
      if (error.status === 403) {
        return 'Voce nao tem permissao para alterar essa senha.';
      }
    }
    return 'Falha ao alterar senha. Tente novamente.';
  }
}
