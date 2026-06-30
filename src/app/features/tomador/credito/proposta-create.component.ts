import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonInput,
  IonNote,
  IonSelect,
  IonSelectOption,
  IonSpinner,
} from '@ionic/angular/standalone';

import { ApiErrorResponse, TipoOperacao } from '../../../core/api/api.models';
import { CreditoMobileService } from '../../../core/credito/credito-mobile.service';
import { OnboardingJourneyStore } from '../../../core/onboarding/onboarding-journey.store';
import { HeaderMobileComponent } from '../../../layout/header-mobile/header-mobile.component';

const TIPOS_OPERACAO: readonly { value: TipoOperacao; label: string }[] = [
  { value: 'CAPITAL_GIRO', label: 'Capital de giro' },
  { value: 'OUTROS', label: 'Outros' },
];

// Criacao de proposta do tomador. Reutiliza o ponteiro {tipo,onboardingId} persistido pela
// M-6 (OnboardingJourneyStore) como `solicitacaoOnboardingId`: o usuario nunca digita UUID.
// Limites maximos, elegibilidade e onboarding APROVADO_FINAL pertencem ao backend; a tela
// so coleta os campos e trata as pre-condicoes devolvidas (404/422).
@Component({
  selector: 'sep-proposta-create',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    IonContent,
    IonInput,
    IonNote,
    IonSelect,
    IonSelectOption,
    IonButton,
    IonSpinner,
    HeaderMobileComponent,
  ],
  templateUrl: './proposta-create.component.html',
  styleUrl: './proposta-create.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PropostaCreateComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly credito = inject(CreditoMobileService);
  private readonly journeyStore = inject(OnboardingJourneyStore);
  private readonly router = inject(Router);

  protected readonly tiposOperacao = TIPOS_OPERACAO;

  readonly carregandoJornada = signal(true);
  readonly onboardingId = signal<string | null>(null);
  readonly submitting = signal(false);
  readonly erro = signal<string | null>(null);
  // 422: onboarding existe mas nao esta APROVADO_FINAL — oferece CTA para revisar a jornada.
  readonly revisarOnboarding = signal(false);

  readonly form = this.fb.group({
    tipoOperacao: this.fb.nonNullable.control<TipoOperacao>('CAPITAL_GIRO', [Validators.required]),
    valorSolicitado: this.fb.control<number | null>(null, [
      Validators.required,
      Validators.min(0.01),
    ]),
    prazoMeses: this.fb.control<number | null>(null, [
      Validators.required,
      Validators.min(1),
      inteiroPositivo,
    ]),
  });

  async ngOnInit(): Promise<void> {
    const journey = await this.journeyStore.carregar();
    this.onboardingId.set(journey?.onboardingId ?? null);
    this.carregandoJornada.set(false);
  }

  async submit(): Promise<void> {
    const onboardingId = this.onboardingId();
    if (!onboardingId || this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.erro.set(null);
    this.revisarOnboarding.set(false);
    const { tipoOperacao, valorSolicitado, prazoMeses } = this.form.getRawValue();
    try {
      const proposta = await this.credito.criarProposta({
        solicitacaoOnboardingId: onboardingId,
        tipoOperacao,
        valorSolicitado: Number(valorSolicitado),
        prazoMeses: Number(prazoMeses),
      });
      await this.router.navigate(['/app/propostas', proposta.id]);
    } catch (err) {
      this.tratarErro(err);
    } finally {
      this.submitting.set(false);
    }
  }

  irParaOnboarding(): void {
    void this.router.navigateByUrl('/app/onboarding');
  }

  private tratarErro(err: unknown): void {
    const mensagem = err instanceof HttpErrorResponse ? mensagemApi(err) : null;
    if (err instanceof HttpErrorResponse && err.status === 422) {
      this.revisarOnboarding.set(true);
      this.erro.set(mensagem ?? 'Seu onboarding ainda nao esta aprovado para solicitar credito.');
      return;
    }
    if (err instanceof HttpErrorResponse && err.status === 404) {
      this.erro.set(mensagem ?? 'Onboarding nao encontrado. Conclua seu cadastro antes.');
      return;
    }
    this.erro.set(mensagem ?? 'Nao foi possivel criar a proposta. Tente novamente.');
  }
}

// Garante prazo inteiro (o backend trabalha em meses inteiros); `min` ja cobre o piso de 1.
function inteiroPositivo(control: AbstractControl): ValidationErrors | null {
  const valor = control.value;
  return valor != null && !Number.isInteger(Number(valor)) ? { inteiro: true } : null;
}

function mensagemApi(err: HttpErrorResponse): string | null {
  return (err.error as ApiErrorResponse | undefined)?.message ?? null;
}
