import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { StatusPixParcelaPublico } from '../../core/api/api.models';

type ToneStatus = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

const ROTULOS: Record<StatusPixParcelaPublico, string> = {
  AGUARDANDO: 'Aguardando',
  EM_PROCESSAMENTO: 'Em processamento',
  LIQUIDADO: 'Liquidado',
  DIVERGENTE: 'Em verificacao',
  FALHOU: 'Falhou',
  EXPIRADO: 'Expirado',
  CANCELADO: 'Cancelado',
};

// Badge semantico do status Pix publico da parcela (StatusPixParcelaPublico), derivado no backend.
// Puramente visual: reflete o estado sem inferir transicao. DIVERGENTE orienta verificacao/suporte;
// FALHOU nunca e apresentado como pago. O texto sempre acompanha a cor (acessibilidade).
@Component({
  selector: 'sep-pix-status-parcela',
  standalone: true,
  imports: [],
  templateUrl: './pix-status-parcela.component.html',
  styleUrl: './pix-status-parcela.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PixStatusParcelaComponent {
  readonly status = input.required<StatusPixParcelaPublico>();

  protected readonly rotulo = computed(() => ROTULOS[this.status()]);
  protected readonly tone = computed<ToneStatus>(() => toneDoStatus(this.status()));
}

// Switch exaustivo sobre o union: adicionar um StatusPixParcelaPublico sem tom quebra a compilacao.
function toneDoStatus(status: StatusPixParcelaPublico): ToneStatus {
  switch (status) {
    case 'LIQUIDADO':
      return 'success';
    case 'EM_PROCESSAMENTO':
      return 'info';
    case 'DIVERGENTE':
      return 'warning';
    case 'FALHOU':
      return 'danger';
    case 'AGUARDANDO':
    case 'EXPIRADO':
    case 'CANCELADO':
      return 'neutral';
  }
}
