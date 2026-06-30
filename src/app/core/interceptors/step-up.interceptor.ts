import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';

import { StepUpTokenStore } from '../auth/step-up-token.store';

/**
 * Anexa o header `X-Step-Up-Token` apenas em rotas sensiveis que exigem
 * step-up authentication (follow-up 5F-FIX-05 da Sprint 5).
 *
 * Rotas cobertas:
 * - `PATCH /usuarios/{id}/senha`: alterar senha
 * - `PATCH /contratos/{id}/aceite`: aceite contratual (M-Sprint 8)
 *
 * O matching e por metodo + path exatos: o `GET` de contrato/versoes/documento
 * nunca recebe o token. O store {@link StepUpTokenStore} mantem o token em
 * memoria com uso unico: apos a chamada o token e descartado, exigindo novo
 * step-up para outra operacao sensivel.
 */
const STEP_UP_ENDPOINTS: { method: string; pattern: RegExp }[] = [
  { method: 'PATCH', pattern: /\/api\/v1\/usuarios\/[^/]+\/senha$/ },
  { method: 'PATCH', pattern: /\/api\/v1\/contratos\/[^/]+\/aceite$/ },
];

export const stepUpInterceptor: HttpInterceptorFn = (req, next) => {
  const exigeStepUp = STEP_UP_ENDPOINTS.some(
    (route) => route.method === req.method && route.pattern.test(req.url),
  );
  if (!exigeStepUp) {
    return next(req);
  }
  const store = inject(StepUpTokenStore);
  const token = store.consume();
  if (!token) {
    return next(req);
  }
  return next(req.clone({ setHeaders: { 'X-Step-Up-Token': token } }));
};
