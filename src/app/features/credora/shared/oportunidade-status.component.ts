import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { StatusOportunidade } from '../../../core/api/api.models';

type Variante = 'disponivel' | 'encerrada';

const ROTULO: Record<StatusOportunidade, string> = {
  DISPONIVEL: 'Disponivel',
  ENCERRADA: 'Encerrada',
};

// Pill semantica do status de uma oportunidade. Puramente visual: reflete o status do backend.
// DISPONIVEL e apenas potencialmente acionavel — elegibilidade e interesse continuam no backend.
@Component({
  selector: 'sep-oportunidade-status',
  standalone: true,
  imports: [],
  templateUrl: './oportunidade-status.component.html',
  styleUrl: './oportunidade-status.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OportunidadeStatusComponent {
  readonly status = input.required<StatusOportunidade>();

  protected readonly rotulo = computed(() => ROTULO[this.status()]);
  protected readonly variante = computed<Variante>(() =>
    this.status() === 'DISPONIVEL' ? 'disponivel' : 'encerrada',
  );
}
