import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  IonButton,
  IonInput,
  IonNote,
  IonSelect,
  IonSelectOption,
  IonSpinner,
} from '@ionic/angular/standalone';

import {
  IniciarOnboardingEmpresaRequest,
  PorteEmpresa,
  TipoSocietario,
} from '../../../core/api/api.models';

// CNPJ com ou sem mascara (backend normaliza). Validacao local cobre apenas formato
// basico; a decisao KYB pertence ao backend.
const CNPJ_PATTERN = /^\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}$/;

const TIPOS_SOCIETARIOS: { valor: TipoSocietario; rotulo: string }[] = [
  { valor: 'LTDA', rotulo: 'LTDA' },
  { valor: 'SA', rotulo: 'S.A.' },
  { valor: 'EIRELI', rotulo: 'EIRELI' },
  { valor: 'MEI', rotulo: 'MEI' },
  { valor: 'OUTROS', rotulo: 'Outros' },
];

const PORTES: { valor: PorteEmpresa; rotulo: string }[] = [
  { valor: 'MEI', rotulo: 'MEI' },
  { valor: 'ME', rotulo: 'Microempresa' },
  { valor: 'EPP', rotulo: 'Pequeno porte' },
  { valor: 'MEDIO', rotulo: 'Medio porte' },
  { valor: 'GRANDE', rotulo: 'Grande porte' },
];

// Formulario de dados PJ (KYB). Componente apresentacional: valida formato basico e
// emite o payload; a chamada ao backend e o estado da jornada ficam no shell.
@Component({
  selector: 'sep-pessoa-juridica-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    IonInput,
    IonNote,
    IonSelect,
    IonSelectOption,
    IonButton,
    IonSpinner,
  ],
  templateUrl: './pessoa-juridica-form.component.html',
  styleUrl: './onboarding-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PessoaJuridicaFormComponent {
  private readonly fb = inject(FormBuilder);

  readonly submitting = input(false);
  readonly errorMessage = input<string | null>(null);
  readonly iniciar = output<IniciarOnboardingEmpresaRequest>();

  protected readonly tiposSocietarios = TIPOS_SOCIETARIOS;
  protected readonly portes = PORTES;

  // tipoSocietario, porte e nomeFantasia sao opcionais no backend (colunas nullable);
  // o form nao adiciona obrigatoriedade alem da documentada (cnpj + razaoSocial).
  readonly form = this.fb.nonNullable.group({
    cnpj: ['', [Validators.required, Validators.pattern(CNPJ_PATTERN)]],
    razaoSocial: ['', [Validators.required]],
    nomeFantasia: [''],
    tipoSocietario: ['' as TipoSocietario | ''],
    porte: ['' as PorteEmpresa | ''],
  });

  submit(): void {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }
    const valor = this.form.getRawValue();
    const request: IniciarOnboardingEmpresaRequest = {
      cnpj: valor.cnpj,
      razaoSocial: valor.razaoSocial,
      nomeFantasia: valor.nomeFantasia || undefined,
      tipoSocietario: valor.tipoSocietario || undefined,
      porte: valor.porte || undefined,
    };
    this.iniciar.emit(request);
  }
}
