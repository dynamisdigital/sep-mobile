import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { StatusParcela } from '../../../core/api/api.models';

type ToneStatus = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

const ROTULOS: Record<StatusParcela, string> = {
  PENDENTE: 'Pendente',
  PARCIALMENTE_PAGA: 'Parcialmente paga',
  PAGA: 'Paga',
  ATRASADA: 'Atrasada',
  INADIMPLENTE: 'Inadimplente',
  EM_NEGOCIACAO: 'Em negociacao',
  RENEGOCIADA: 'Renegociada',
};

// Badge semantico do status da parcela, compartilhado por lista e detalhe. Puramente visual:
// reflete o status do backend sem inferir transicao nem derivar estado por data/valor. O texto
// sempre acompanha a cor (acessibilidade); a cor nunca e a unica informacao.
@Component({
  selector: 'sep-parcela-status',
  standalone: true,
  imports: [],
  templateUrl: './parcela-status.component.html',
  styleUrl: './parcela-status.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ParcelaStatusComponent {
  readonly status = input.required<StatusParcela>();

  protected readonly rotulo = computed(() => ROTULOS[this.status()]);
  protected readonly tone = computed<ToneStatus>(() => toneDoStatus(this.status()));
}

// Switch exaustivo sobre o union: adicionar um StatusParcela sem tom aqui quebra a compilacao.
function toneDoStatus(status: StatusParcela): ToneStatus {
  switch (status) {
    case 'PAGA':
      return 'success';
    case 'ATRASADA':
      return 'warning';
    case 'INADIMPLENTE':
      return 'danger';
    case 'PARCIALMENTE_PAGA':
    case 'EM_NEGOCIACAO':
      return 'info';
    case 'PENDENTE':
    case 'RENEGOCIADA':
      return 'neutral';
  }
}
