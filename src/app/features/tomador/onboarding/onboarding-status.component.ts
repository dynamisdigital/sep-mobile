import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { ResultadoOnboardingResponse, StatusOnboarding } from '../../../core/api/api.models';

type VarianteStatus = 'aprovado' | 'reprovado' | 'pendente' | 'andamento';

const ROTULOS: Record<StatusOnboarding, string> = {
  INICIADO: 'Iniciado',
  DOCUMENTOS_RECEBIDOS: 'Documentos recebidos',
  EM_VERIFICACAO: 'Em verificacao',
  APROVADO: 'Aprovado (KYC/KYB)',
  REPROVADO: 'Reprovado',
  PENDENCIA: 'Pendencia',
  APROVADO_FINAL: 'Aprovado',
  REPROVADO_PLD: 'Reprovado (PLD)',
};

// Apresenta o status de onboarding como badge semantico + linha de resultado. Componente
// puramente visual: nao decide transicoes; so reflete o estado devolvido pelo backend.
@Component({
  selector: 'sep-onboarding-status',
  standalone: true,
  imports: [],
  templateUrl: './onboarding-status.component.html',
  styleUrl: './onboarding-status.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OnboardingStatusComponent {
  readonly status = input.required<StatusOnboarding>();
  readonly resultado = input<ResultadoOnboardingResponse | null>(null);

  protected readonly variante = computed<VarianteStatus>(() => varianteDoStatus(this.status()));
  protected readonly rotulo = computed(() => ROTULOS[this.status()]);
}

function varianteDoStatus(status: StatusOnboarding): VarianteStatus {
  switch (status) {
    case 'APROVADO':
    case 'APROVADO_FINAL':
      return 'aprovado';
    case 'REPROVADO':
    case 'REPROVADO_PLD':
      return 'reprovado';
    case 'PENDENCIA':
      return 'pendente';
    case 'INICIADO':
    case 'DOCUMENTOS_RECEBIDOS':
    case 'EM_VERIFICACAO':
      return 'andamento';
  }
}
