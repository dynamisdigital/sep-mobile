import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonButton, IonContent, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { briefcaseOutline, shieldCheckmarkOutline, walletOutline } from 'ionicons/icons';

@Component({
  selector: 'sep-welcome',
  standalone: true,
  imports: [IonContent, IonButton, IonIcon, RouterLink],
  templateUrl: './welcome.component.html',
  styleUrls: ['./welcome.component.scss'],
})
export class WelcomeComponent {
  constructor() {
    addIcons({ briefcaseOutline, walletOutline, shieldCheckmarkOutline });
  }
}
