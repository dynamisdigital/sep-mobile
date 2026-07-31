// Senhas compativeis com a politica do sep-api (PasswordPolicy: 12+ caracteres OU passphrase de 4+
// palavras), espelhada no mock MSW. Ate a M-Sprint 17 eram '123456'/'654321', recusadas com 400
// pelo proprio mock — uma das tres causas de o `golden-path-mobile` nunca ter passado.
// O controle positivo em `golden-path-mobile.spec.ts` trava isso: se uma derivacao futura voltar a
// violar a politica, o smoke acusa em vez de degradar em silencio.
export const defaultPassword = 'senha-inicial-forte-2026';
export const changedPassword = 'senha-trocada-forte-2026';

export function uniqueEmail(prefix = 'mobile'): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}@empresa.com`;
}
