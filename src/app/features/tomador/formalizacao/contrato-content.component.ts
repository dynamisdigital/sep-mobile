import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IonButton } from '@ionic/angular/standalone';

import { VersaoContratoResponse } from '../../../core/api/api.models';
import { DIA_MES_ANO, formatarDataIso } from '../../../core/format/data';

// Apresentacional: renderiza uma versao de contrato (cabecalho + hash + texto + clausulas) como
// texto puro, nunca HTML. Sem estado proprio nem chamadas de rede; o detalhe orquestra carga,
// selecao, copia e historico. `vigente` controla o badge e a acao de voltar (versao historica).
@Component({
  selector: 'sep-contrato-content',
  standalone: true,
  imports: [IonButton],
  templateUrl: './contrato-content.component.html',
  styleUrl: './contrato-content.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContratoContentComponent {
  readonly versao = input.required<VersaoContratoResponse>();
  readonly vigente = input.required<boolean>();
  readonly hashCopiado = input(false);

  readonly copiar = output<string>();
  readonly voltarVigente = output<void>();

  protected dataFormatada(iso: string): string {
    return formatarDataIso(iso, DIA_MES_ANO);
  }
}
