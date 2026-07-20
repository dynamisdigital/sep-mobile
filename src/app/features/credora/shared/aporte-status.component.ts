import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { StatusAporteCredora } from '../../../core/api/api.models';

type ToneStatus = 'neutral' | 'info' | 'success' | 'danger';

const ROTULOS: Record<StatusAporteCredora, string> = {
  PENDENTE: 'Pendente',
  EM_PROCESSAMENTO: 'Em processamento',
  LIQUIDADO: 'Liquidado',
  FALHOU: 'Falhou',
};

// Badge semantico do status de um aporte da propria operacao (backend Sprint 29). Puramente
// visual: reflete o status do backend sem derivar transicao nem presumir liquidacao. O texto
// sempre acompanha a cor (acessibilidade); a cor nunca e a unica informacao.
@Component({
  selector: 'sep-aporte-status',
  standalone: true,
  imports: [],
  templateUrl: './aporte-status.component.html',
  styleUrl: './aporte-status.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AporteStatusComponent {
  readonly status = input.required<StatusAporteCredora>();

  protected readonly rotulo = computed(() => ROTULOS[this.status()]);
  protected readonly tone = computed<ToneStatus>(() => toneDoStatus(this.status()));
}

// Switch exaustivo sobre o union: adicionar um StatusAporteCredora sem tom aqui quebra a
// compilacao.
function toneDoStatus(status: StatusAporteCredora): ToneStatus {
  switch (status) {
    case 'LIQUIDADO':
      return 'success';
    case 'EM_PROCESSAMENTO':
      return 'info';
    case 'FALHOU':
      return 'danger';
    case 'PENDENTE':
      return 'neutral';
  }
}
