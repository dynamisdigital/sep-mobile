import { Component } from '@angular/core';
import { IonContent } from '@ionic/angular/standalone';

@Component({
  selector: 'sep-splash',
  standalone: true,
  imports: [IonContent],
  template: `<ion-content class="ion-padding"><p>SEP</p></ion-content>`,
})
export class SplashComponent {}
