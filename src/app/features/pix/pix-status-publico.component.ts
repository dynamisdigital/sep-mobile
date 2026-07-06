import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { StatusPixPublico } from '../../core/api/api.models';

type ToneStatus = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

const ROTULOS: Record<StatusPixPublico, string> = {
  EM_PROCESSAMENTO: 'Em processamento',
  LIQUIDADO: 'Liquidado',
  FALHOU: 'Falhou',
  CANCELADO: 'Cancelado',
};

// Badge semantico do status Pix publico (StatusPixPublico), compartilhado pelo desembolso do
// tomador (P1) e pela operacao da credora (P3). Puramente visual: reflete o status do backend sem
// derivar transicao. O texto sempre acompanha a cor (acessibilidade); a cor nunca e a unica
// informacao.
@Component({
  selector: 'sep-pix-status-publico',
  standalone: true,
  imports: [],
  templateUrl: './pix-status-publico.component.html',
  styleUrl: './pix-status-publico.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PixStatusPublicoComponent {
  readonly status = input.required<StatusPixPublico>();

  protected readonly rotulo = computed(() => ROTULOS[this.status()]);
  protected readonly tone = computed<ToneStatus>(() => toneDoStatus(this.status()));
}

// Switch exaustivo sobre o union: adicionar um StatusPixPublico sem tom aqui quebra a compilacao.
function toneDoStatus(status: StatusPixPublico): ToneStatus {
  switch (status) {
    case 'LIQUIDADO':
      return 'success';
    case 'EM_PROCESSAMENTO':
      return 'info';
    case 'FALHOU':
      return 'danger';
    case 'CANCELADO':
      return 'neutral';
  }
}
