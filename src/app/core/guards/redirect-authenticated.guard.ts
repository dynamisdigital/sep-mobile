import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../auth/auth.service';

/**
 * Guard das telas publicas de entrada (welcome/login/register): usuario com
 * sessao valida nao deve reve-las — e mandado para a home autenticada, o
 * mesmo destino que o splash resolve. Achado do smoke nativo da M-Sprint 13:
 * o botao voltar fisico do Android faz pop do historico do WebView e, sem
 * este guard, devolvia um usuario logado para /login.
 */
export const redirectAuthenticatedGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.currentUser()) {
    return router.parseUrl('/app/inicio');
  }

  if (!(await auth.hasToken())) {
    return true;
  }

  const usuario = await auth.loadCurrentUser();
  return usuario ? router.parseUrl('/app/inicio') : true;
};
