import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { StatusOperacaoFinanciada } from '../../../core/api/api.models';

type Variante = 'associada' | 'encerrada';

const ROTULO: Record<StatusOperacaoFinanciada, string> = {
  ASSOCIADA: 'Associada',
  ENCERRADA: 'Encerrada',
};

// Pill semantica do status de uma operacao financiada da carteira. Puramente visual: reflete o
// status do backend, sem recalcular saldo ou situacao contratual.
@Component({
  selector: 'sep-operacao-status',
  standalone: true,
  imports: [],
  templateUrl: './operacao-status.component.html',
  styleUrl: './operacao-status.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OperacaoStatusComponent {
  readonly status = input.required<StatusOperacaoFinanciada>();

  protected readonly rotulo = computed(() => ROTULO[this.status()]);
  protected readonly variante = computed<Variante>(() =>
    this.status() === 'ASSOCIADA' ? 'associada' : 'encerrada',
  );
}
