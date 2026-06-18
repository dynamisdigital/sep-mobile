import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';

import { HeaderMobileComponent } from '../../../layout/header-mobile/header-mobile.component';

// Shell da jornada de onboarding do tomador. Nesta etapa expoe apenas o chrome da
// pagina (cabecalho + retorno para a home); o estado da jornada, selecao PF/PJ,
// formularios e status sao adicionados nas tasks seguintes da M-Sprint 6.
@Component({
  selector: 'sep-onboarding-shell',
  standalone: true,
  imports: [IonContent, RouterLink, HeaderMobileComponent],
  templateUrl: './onboarding-shell.component.html',
  styleUrl: './onboarding-shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OnboardingShellComponent {}
