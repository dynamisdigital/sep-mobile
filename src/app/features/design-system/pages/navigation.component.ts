import { Component } from '@angular/core';
import { IonContent, IonNote } from '@ionic/angular/standalone';

@Component({
  selector: 'sep-ds-navigation',
  standalone: true,
  imports: [IonContent, IonNote],
  template: `
    <ion-content class="ion-padding">
      <h2>Padroes de navegacao</h2>
      <p>
        O app SEP Mobile usa <strong>tabs inferiores</strong> como navegacao principal (visivel logo
        abaixo deste conteudo) e <strong>navegacao em pilha</strong>
        para fluxos lineares dentro de cada tab.
      </p>

      <h3>Tabs (rodape)</h3>
      <p>
        Altura 56px + safe-area. 4 tabs visiveis no maximo. Selecionado no azul do design system,
        com wash de fundo no item ativo.
      </p>

      <h3>Pilha</h3>
      <p>
        Header com titulo + botao voltar. Transicoes nativas (slide horizontal no iOS, fade/slide no
        Android).
      </p>

      <ion-note> Telas reais (Tomador/Credora) sao implementadas a partir da M-Sprint 4. </ion-note>
    </ion-content>
  `,
})
export class NavigationComponent {}
