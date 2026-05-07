import { Component } from '@angular/core';
import { IonContent } from '@ionic/angular/standalone';

@Component({
  selector: 'sep-welcome',
  standalone: true,
  imports: [IonContent],
  template: `<ion-content class="ion-padding"><p>Welcome</p></ion-content>`,
})
export class WelcomeComponent {}
