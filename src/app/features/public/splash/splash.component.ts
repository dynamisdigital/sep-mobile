import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonSpinner } from '@ionic/angular/standalone';

import { AuthService } from '../../../core/auth/auth.service';

export const SPLASH_DELAY_MS = 1500;

@Component({
  selector: 'sep-splash',
  standalone: true,
  imports: [IonContent, IonSpinner],
  templateUrl: './splash.component.html',
  styleUrls: ['./splash.component.scss'],
})
export class SplashComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  async ngOnInit(): Promise<void> {
    const [, usuario] = await Promise.all([
      new Promise((resolve) => setTimeout(resolve, SPLASH_DELAY_MS)),
      this.auth.loadCurrentUser(),
    ]);
    await this.router.navigateByUrl(usuario ? '/app/inicio' : '/welcome');
  }
}
