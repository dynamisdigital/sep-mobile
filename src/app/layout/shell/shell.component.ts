import { ChangeDetectionStrategy, Component } from '@angular/core';
import { IonRouterOutlet, IonTabs } from '@ionic/angular/standalone';

import { HeaderMobileComponent } from '../header-mobile/header-mobile.component';
import { TabsComponent } from '../tabs/tabs.component';

@Component({
  selector: 'sep-shell',
  standalone: true,
  imports: [IonRouterOutlet, IonTabs, HeaderMobileComponent, TabsComponent],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShellComponent {}
