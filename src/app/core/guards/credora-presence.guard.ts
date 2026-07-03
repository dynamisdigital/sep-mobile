import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { CredoraContextStore } from '../credores/credora-context.store';

// Guard de presenca da jornada credora. Nao existe role `CREDORA`: o acesso e governado por
// autenticacao (parent `authGuard`) + presenca de credora confirmada por `GET /credores/me`.
//
// - `presente` (200): libera.
// - `ausente` (404): usuario nao possui credora -> redireciona para a home do app (superficie
//   neutra, nao credora -> sem loop de navegacao).
// - `erro` (rede/5xx): NAO conclui "nao e credora"; libera para a tela mostrar seu proprio
//   erro + retry controlado (a autorizacao real dos dados continua no backend).
//
// A autorizacao final de cada endpoint permanece no backend; este guard e apenas UX.
export const credoraPresenceGuard: CanActivateFn = async () => {
  const store = inject(CredoraContextStore);
  const router = inject(Router);

  const presenca = await store.carregar();
  if (presenca === 'ausente') {
    return router.parseUrl('/app/inicio');
  }
  return true;
};
