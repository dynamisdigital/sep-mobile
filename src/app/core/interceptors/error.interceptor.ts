import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, from, switchMap, throwError } from 'rxjs';

import { AuthService } from '../auth/auth.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse)) {
        return throwError(() => error);
      }

      if (error.status === 401 && !req.url.includes('/auth/login')) {
        return from(auth.clearSession()).pipe(
          switchMap(() => {
            void router.navigateByUrl('/session-expired');
            return throwError(() => error);
          }),
        );
      }

      if (error.status === 403) {
        void router.navigateByUrl('/access-denied');
      }

      return throwError(() => error);
    }),
  );
};
