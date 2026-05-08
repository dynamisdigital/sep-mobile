import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { IonContent } from '@ionic/angular/standalone';

import { HeaderMobileComponent } from '../../../layout/header-mobile/header-mobile.component';

@Component({
  selector: 'sep-placeholder',
  standalone: true,
  imports: [IonContent, HeaderMobileComponent],
  templateUrl: './placeholder.component.html',
  styleUrl: './placeholder.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlaceholderComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly data = toSignal(this.route.data, { initialValue: this.route.snapshot.data });

  readonly title = computed(() => (this.data()?.['title'] as string) ?? 'Em preparacao');
}
