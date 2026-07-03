import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { StatusCredora, StatusElegibilidade } from '../../../core/api/api.models';

type Variante = 'positivo' | 'negativo' | 'pendente' | 'neutro';

// Copy neutra: estados sensiveis (PENDENTE/INELEGIVEL/SUSPENSA) sem linguagem alarmista.
const ROTULO_STATUS: Record<StatusCredora, string> = {
  CADASTRADA: 'Cadastrada',
  ATIVA: 'Ativa',
  SUSPENSA: 'Suspensa',
};
const ROTULO_ELEGIBILIDADE: Record<StatusElegibilidade, string> = {
  PENDENTE: 'Elegibilidade pendente',
  ELEGIVEL: 'Elegivel',
  INELEGIVEL: 'Inelegivel',
};

// Pills semanticas do status cadastral + elegibilidade da credora. Reflexo direto do backend:
// nao infere ATIVA a partir de ELEGIVEL nem vice-versa. Puramente visual; usado por dashboard
// e perfil.
@Component({
  selector: 'sep-credora-status',
  standalone: true,
  imports: [],
  templateUrl: './credora-status.component.html',
  styleUrl: './credora-status.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CredoraStatusComponent {
  readonly status = input.required<StatusCredora>();
  readonly elegibilidade = input.required<StatusElegibilidade>();

  protected readonly rotuloStatus = computed(() => ROTULO_STATUS[this.status()]);
  protected readonly rotuloElegibilidade = computed(
    () => ROTULO_ELEGIBILIDADE[this.elegibilidade()],
  );
  protected readonly varianteStatus = computed<Variante>(() => varianteStatus(this.status()));
  protected readonly varianteElegibilidade = computed<Variante>(() =>
    varianteElegibilidade(this.elegibilidade()),
  );
}

function varianteStatus(status: StatusCredora): Variante {
  switch (status) {
    case 'ATIVA':
      return 'positivo';
    case 'CADASTRADA':
      return 'neutro';
    case 'SUSPENSA':
      return 'negativo';
  }
}

function varianteElegibilidade(elegibilidade: StatusElegibilidade): Variante {
  switch (elegibilidade) {
    case 'ELEGIVEL':
      return 'positivo';
    case 'PENDENTE':
      return 'pendente';
    case 'INELEGIVEL':
      return 'negativo';
  }
}
