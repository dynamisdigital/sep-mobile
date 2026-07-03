import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { IonButton, IonContent, IonSpinner } from '@ionic/angular/standalone';

import { TipoCredora } from '../../../core/api/api.models';
import { CredoraContextStore } from '../../../core/credores/credora-context.store';
import { HeaderMobileComponent } from '../../../layout/header-mobile/header-mobile.component';
import { CredoraStatusComponent } from '../shared/credora-status.component';

const ROTULO_TIPO: Record<TipoCredora, string> = {
  EMPRESA: 'Empresa',
  INSTITUICAO_FINANCEIRA: 'Instituicao financeira',
};

// Perfil da empresa credora: snapshot do backend (/me). Nao edita, nao reexecuta KYB/PLD e nao
// deriva elegibilidade de status/CNPJ. Nao exibe identificadores internos (usuarioId,
// onboardingId). Copy neutra para estados sensiveis via CredoraStatusComponent.
@Component({
  selector: 'sep-credora-profile',
  standalone: true,
  imports: [IonContent, IonSpinner, IonButton, HeaderMobileComponent, CredoraStatusComponent],
  templateUrl: './credora-profile.component.html',
  styleUrl: './credora-profile.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CredoraProfileComponent implements OnInit {
  private readonly store = inject(CredoraContextStore);

  readonly estado = this.store.estado;
  readonly credora = this.store.credora;

  async ngOnInit(): Promise<void> {
    await this.carregar();
  }

  async carregar(): Promise<void> {
    await this.store.carregar();
  }

  protected rotuloTipo(tipo: TipoCredora): string {
    return ROTULO_TIPO[tipo];
  }

  protected capacidadeFormatada(valor: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
  }

  protected dataFormatada(iso: string): string {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(iso));
  }
}
