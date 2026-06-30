import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { StatusProposta } from '../../../core/api/api.models';

type VarianteStatus = 'aprovado' | 'reprovado' | 'pendente' | 'andamento';

const ROTULOS: Record<StatusProposta, string> = {
  EM_ANALISE: 'Em analise',
  PRE_APROVADA: 'Pre-aprovada',
  PENDENCIA: 'Pendencia',
  APROVADA: 'Aprovada',
  REJEITADA: 'Rejeitada',
};

// Badge semantico do status da proposta, compartilhado por lista e detalhe. Componente
// puramente visual: reflete o status do backend sem inferir transicao. PRE_APROVADA recebe
// tom "andamento" (nao aprovacao final), conforme a regra da M-Sprint 7.
@Component({
  selector: 'sep-proposta-status',
  standalone: true,
  imports: [],
  templateUrl: './proposta-status.component.html',
  styleUrl: './proposta-status.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PropostaStatusComponent {
  readonly status = input.required<StatusProposta>();

  protected readonly rotulo = computed(() => ROTULOS[this.status()]);
  protected readonly variante = computed<VarianteStatus>(() => varianteDoStatus(this.status()));
}

function varianteDoStatus(status: StatusProposta): VarianteStatus {
  switch (status) {
    case 'APROVADA':
      return 'aprovado';
    case 'REJEITADA':
      return 'reprovado';
    case 'PENDENCIA':
      return 'pendente';
    case 'EM_ANALISE':
    case 'PRE_APROVADA':
      return 'andamento';
  }
}
