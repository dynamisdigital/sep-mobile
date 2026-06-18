import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { IonButton, IonInput, IonNote, IonSpinner } from '@ionic/angular/standalone';

import { IniciarOnboardingPessoaRequest } from '../../../core/api/api.models';

// CPF com ou sem mascara (backend normaliza). Validacao local cobre apenas formato
// basico; a decisao KYC pertence ao backend.
const CPF_PATTERN = /^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/;

// Formulario de dados PF (KYC). Componente apresentacional: valida formato basico e
// emite o payload; a chamada ao backend e o estado da jornada ficam no shell.
@Component({
  selector: 'sep-pessoa-fisica-form',
  standalone: true,
  imports: [ReactiveFormsModule, IonInput, IonNote, IonButton, IonSpinner],
  templateUrl: './pessoa-fisica-form.component.html',
  styleUrl: './onboarding-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PessoaFisicaFormComponent {
  private readonly fb = inject(FormBuilder);

  readonly submitting = input(false);
  readonly errorMessage = input<string | null>(null);
  readonly iniciar = output<IniciarOnboardingPessoaRequest>();

  readonly form = this.fb.nonNullable.group({
    cpf: ['', [Validators.required, Validators.pattern(CPF_PATTERN)]],
    nomeCompleto: ['', [Validators.required]],
    dataNascimento: ['', [Validators.required]],
  });

  submit(): void {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }
    this.iniciar.emit(this.form.getRawValue());
  }
}
