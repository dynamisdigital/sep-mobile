import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, from, of, switchMap, throwError } from 'rxjs';

import { withSupportReference } from '../api/support-reference';
import { AuthService } from '../auth/auth.service';

/**
 * Encerra a sessao, leva o usuario ao destino de seguranca e propaga o erro ORIGINAL.
 *
 * O `catchError` nao e defesa preventiva: `clearSession()` chama `tokenStorage.clearAll()`, que em
 * device e Capacitor Preferences e pode falhar de verdade. Sem ele, `from(promiseRejeitada)` nunca
 * executa o `switchMap` — o usuario NAO era redirecionado e ainda recebia o erro de storage no lugar
 * do 401/423, ficando numa tela autenticada com a sessao pela metade e sem nada explicando o que
 * houve. Falhar ao limpar nao pode reter ninguem na tela: sair e mais importante, e o status
 * original e o que `login.component`, `verify-totp.component` e os guards discriminam.
 *
 * A falha de limpeza e relevante (tokens podem sobreviver no device), entao vai para o console em
 * vez de sumir — e o unico canal de log que o app tem hoje.
 */
function encerrarSessaoENavegar(
  auth: AuthService,
  router: Router,
  destino: string,
  error: HttpErrorResponse,
): Observable<never> {
  return from(auth.clearSession()).pipe(
    catchError((falhaAoLimpar: unknown) => {
      console.error(`Falha ao limpar a sessao apos ${error.status}:`, falhaAoLimpar);
      return of(undefined);
    }),
    switchMap(() => {
      void router.navigateByUrl(destino);
      return throwError(() => error);
    }),
  );
}

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse)) {
        return throwError(() => error);
      }

      const isLogoutOrLogin = req.url.includes('/auth/login') || req.url.includes('/auth/logout');
      if (error.status === 401 && !isLogoutOrLogin) {
        return encerrarSessaoENavegar(auth, router, '/session-expired', error);
      }

      if (error.status === 403) {
        void router.navigateByUrl('/access-denied');
      }

      // Sprint 5: 423 Locked = conta bloqueada.
      if (error.status === 423) {
        return encerrarSessaoENavegar(auth, router, '/account-locked', error);
      }

      return throwError(() => withSupportReference(error));
    }),
  );
};
