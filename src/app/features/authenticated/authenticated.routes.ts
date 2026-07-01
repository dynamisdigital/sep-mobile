import { Routes } from '@angular/router';

import { authGuard } from '../../core/guards/auth.guard';
import { roleGuard } from '../../core/guards/role.guard';

export const AUTHENTICATED_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('../../layout/shell/shell.component').then((m) => m.ShellComponent),
    canActivate: [authGuard],
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'inicio',
      },
      {
        path: 'inicio',
        loadComponent: () =>
          import('../tomador/home/home.component').then((m) => m.TomadorHomeComponent),
        data: { tab: 'inicio' },
      },
      {
        path: 'onboarding',
        loadComponent: () =>
          import('../tomador/onboarding/onboarding-shell.component').then(
            (m) => m.OnboardingShellComponent,
          ),
        data: { tab: 'inicio' },
      },
      {
        path: 'propostas',
        canActivate: [roleGuard],
        loadComponent: () =>
          import('../tomador/credito/propostas-list.component').then(
            (m) => m.PropostasListComponent,
          ),
        data: { roles: ['CLIENTE'], tab: 'propostas', title: 'Propostas' },
      },
      {
        path: 'propostas/nova',
        canActivate: [roleGuard],
        loadComponent: () =>
          import('../tomador/credito/proposta-create.component').then(
            (m) => m.PropostaCreateComponent,
          ),
        data: { roles: ['CLIENTE'], tab: 'propostas', title: 'Solicitar credito' },
      },
      {
        path: 'propostas/:id',
        canActivate: [roleGuard],
        loadComponent: () =>
          import('../tomador/credito/proposta-detail.component').then(
            (m) => m.PropostaDetailComponent,
          ),
        data: { roles: ['CLIENTE'], tab: 'propostas', title: 'Proposta' },
      },
      {
        path: 'propostas/:id/open-finance',
        canActivate: [roleGuard],
        loadComponent: () =>
          import('../tomador/credito/open-finance.component').then((m) => m.OpenFinanceComponent),
        data: { roles: ['CLIENTE'], tab: 'propostas', title: 'Open Finance' },
      },
      {
        path: 'propostas/:id/open-finance/retorno',
        canActivate: [roleGuard],
        loadComponent: () =>
          import('../tomador/credito/open-finance.component').then((m) => m.OpenFinanceComponent),
        data: { roles: ['CLIENTE'], tab: 'propostas', title: 'Open Finance', retorno: true },
      },
      {
        path: 'formalizacao',
        canActivate: [roleGuard],
        loadComponent: () =>
          import('../tomador/formalizacao/formalizacao-list.component').then(
            (m) => m.FormalizacaoListComponent,
          ),
        data: { roles: ['CLIENTE'], tab: 'propostas', title: 'Formalizacao' },
      },
      {
        path: 'formalizacao/proposta/:propostaId',
        canActivate: [roleGuard],
        loadComponent: () =>
          import('../tomador/formalizacao/contrato-detail.component').then(
            (m) => m.ContratoDetailComponent,
          ),
        data: { roles: ['CLIENTE'], tab: 'propostas', title: 'Contrato' },
      },
      {
        path: 'formalizacao/contratos/:contratoId',
        canActivate: [roleGuard],
        loadComponent: () =>
          import('../tomador/formalizacao/contrato-detail.component').then(
            (m) => m.ContratoDetailComponent,
          ),
        data: { roles: ['CLIENTE'], tab: 'propostas', title: 'Contrato' },
      },
      {
        path: 'parcelas',
        canActivate: [roleGuard],
        loadComponent: () =>
          import('../tomador/cobranca/parcelas-entry.component').then(
            (m) => m.ParcelasEntryComponent,
          ),
        data: { roles: ['CLIENTE'], tab: 'parcelas', title: 'Parcelas' },
      },
      {
        path: 'parcelas/proposta/:propostaId',
        canActivate: [roleGuard],
        loadComponent: () =>
          import('../tomador/cobranca/agenda-detail.component').then(
            (m) => m.AgendaDetailComponent,
          ),
        data: { roles: ['CLIENTE'], tab: 'parcelas', title: 'Parcelas' },
      },
      {
        path: 'parcelas/contratos/:contratoId',
        canActivate: [roleGuard],
        loadComponent: () =>
          import('../tomador/cobranca/agenda-detail.component').then(
            (m) => m.AgendaDetailComponent,
          ),
        data: { roles: ['CLIENTE'], tab: 'parcelas', title: 'Parcelas' },
      },
      {
        path: 'perfil',
        loadComponent: () => import('./profile/profile.component').then((m) => m.ProfileComponent),
        data: { tab: 'perfil' },
      },
      {
        path: 'perfil/alterar-senha',
        loadComponent: () =>
          import('./profile/change-password/change-password.component').then(
            (m) => m.ChangePasswordComponent,
          ),
        data: { tab: 'perfil' },
      },
      {
        path: 'perfil/biometria',
        loadComponent: () =>
          import('./profile/setup-biometric/setup-biometric.component').then(
            (m) => m.SetupBiometricComponent,
          ),
        data: { tab: 'perfil' },
      },
      {
        path: 'step-up',
        loadComponent: () => import('./step-up/step-up.component').then((m) => m.StepUpComponent),
        data: { tab: 'perfil' },
      },
      {
        path: 'credora/inicio',
        loadComponent: () =>
          import('../credora/home/home.component').then((m) => m.CredoraHomeComponent),
        data: { tab: 'credora-inicio' },
      },
      {
        path: 'admin',
        canActivate: [roleGuard],
        data: { roles: ['ADMIN'], tab: 'admin', title: 'Administracao' },
        loadComponent: () =>
          import('./placeholder/placeholder.component').then((m) => m.PlaceholderComponent),
      },
    ],
  },
];
