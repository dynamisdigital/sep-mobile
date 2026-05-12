import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';

import { ApiErrorResponse } from '../../../core/api/api.models';
import { StepUpService } from '../../../core/auth/step-up.service';
import { HeaderMobileComponent } from '../../../layout/header-mobile/header-mobile.component';

/**
 * Tela de step-up authentication mobile (follow-up 5F-FIX-05 da Sprint 5).
 *
 * Fluxo:
 * 1. ngOnInit inicia o challenge via {@link StepUpService.initiate}.
 * 2. Usuario digita codigo TOTP (6 digitos) ou backup code.
 * 3. submit() chama {@link StepUpService.complete}; em sucesso o token vai
 *    para o store (uso unico) e a tela navega para a rota informada em
 *    `?next=...` ou {@code /app/perfil/alterar-senha} como fallback.
 */
@Component({
  selector: 'sep-step-up',
  standalone: true,
  imports: [IonContent, ReactiveFormsModule, RouterLink, HeaderMobileComponent],
  templateUrl: './step-up.component.html',
  styleUrl: './step-up.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StepUpComponent implements OnInit {
  private readonly stepUp = inject(StepUpService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly codigo = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(6)],
  });
  readonly loadingChallenge = signal(true);
  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly challengeId = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    try {
      const resp = await this.stepUp.initiate();
      this.challengeId.set(resp.stepUpChallengeId);
    } catch (error) {
      this.errorMessage.set(this.extractMessage(error));
    } finally {
      this.loadingChallenge.set(false);
    }
  }

  async submit(): Promise<void> {
    if (this.submitting() || this.codigo.invalid) {
      this.codigo.markAsTouched();
      return;
    }
    const challenge = this.challengeId();
    if (!challenge) {
      this.errorMessage.set('Step-up nao foi iniciado. Tente novamente.');
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);
    try {
      await this.stepUp.complete({
        stepUpChallengeId: challenge,
        codigo: this.codigo.value,
      });
      void this.router.navigateByUrl(this.nextUrl());
    } catch (error) {
      this.errorMessage.set(this.extractMessage(error));
    } finally {
      this.submitting.set(false);
    }
  }

  private nextUrl(): string {
    const raw = this.route.snapshot.queryParamMap.get('next');
    if (!raw) {
      return '/app/perfil/alterar-senha';
    }
    // Aceita somente URLs relativas pra evitar open-redirect.
    return raw.startsWith('/') ? raw : '/app/perfil/alterar-senha';
  }

  private extractMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const body = error.error as ApiErrorResponse | null | undefined;
      if (body?.message) {
        return body.message;
      }
      if (error.status === 400) {
        return 'Codigo invalido ou expirado.';
      }
      if (error.status === 401 || error.status === 403) {
        return 'Sessao expirada para iniciar step-up.';
      }
    }
    return 'Falha na verificacao. Tente novamente.';
  }
}
