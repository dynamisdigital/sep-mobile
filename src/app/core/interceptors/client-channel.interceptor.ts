import { HttpInterceptorFn } from '@angular/common/http';

import { environment } from '../../../environments/environment';

/**
 * Anexa `X-Client-Channel: MOBILE` em toda chamada para a API (follow-up
 * 5F-FIX-02 da Sprint 5).
 *
 * Em canal MOBILE o backend mantem o refresh token no body do TokenResponse
 * (persistencia local via Capacitor Preferences). Cookie nao se aplica em
 * apps nativos — por isso `withCredentials` nao e ativado aqui.
 *
 * Aplica apenas a URLs que comecam com `environment.apiBaseUrl` para evitar
 * vazar o header em chamadas a CDNs, analytics etc.
 */
export const clientChannelInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(environment.apiBaseUrl)) {
    return next(req);
  }
  return next(
    req.clone({
      setHeaders: { 'X-Client-Channel': 'MOBILE' },
    }),
  );
};
