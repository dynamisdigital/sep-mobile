import { ChangeDetectionStrategy, Component } from '@angular/core';
import { IonRouterOutlet, IonTabs } from '@ionic/angular/standalone';

import { TabsComponent } from '../tabs/tabs.component';

@Component({
  selector: 'sep-shell',
  standalone: true,
  imports: [IonRouterOutlet, IonTabs, TabsComponent],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShellComponent {}
