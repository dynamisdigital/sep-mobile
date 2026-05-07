import { Component } from '@angular/core';
import { IonContent } from '@ionic/angular/standalone';

@Component({
  selector: 'sep-login',
  standalone: true,
  imports: [IonContent],
  template: `<ion-content class="ion-padding"><p>Login</p></ion-content>`,
})
export class LoginComponent {}
