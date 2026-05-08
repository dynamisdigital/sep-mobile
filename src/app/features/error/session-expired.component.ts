import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';

@Component({
  selector: 'sep-session-expired',
  standalone: true,
  imports: [IonContent, RouterLink],
  templateUrl: './session-expired.component.html',
  styleUrl: './session-expired.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SessionExpiredComponent {}
