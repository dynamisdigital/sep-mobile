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
        path: 'propostas',
        loadComponent: () =>
          import('./placeholder/placeholder.component').then((m) => m.PlaceholderComponent),
        data: { tab: 'propostas', title: 'Propostas' },
      },
      {
        path: 'parcelas',
        loadComponent: () =>
          import('./placeholder/placeholder.component').then((m) => m.PlaceholderComponent),
        data: { tab: 'parcelas', title: 'Parcelas' },
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
