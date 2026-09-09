import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';

import { mensagemOnboardingErro } from './onboarding-error';

const PADRAO = 'Nao foi possivel concluir o onboarding. Tente novamente.';

// M-Sprint 18: este chamador passou a delegar a guarda de shape para `mensagemDaApi`. Os casos
// abaixo travam o CONTRATO do chamador (quando o padrao entra), nao a implementacao do helper.
describe('mensagemOnboardingErro', () => {
  it('usa a mensagem do backend quando ela existe', () => {
    const erro = new HttpErrorResponse({
      status: 409,
      error: { message: 'Ja existe onboarding ativo para este CPF' },
    });
    expect(mensagemOnboardingErro(erro, PADRAO)).toBe('Ja existe onboarding ativo para este CPF');
  });

  it.each([
    ['corpo sem message', { status: 409 }],
    ['message em branco', { message: '   ' }],
    ['message numerica', { message: 409 }],
    ['corpo null', null],
    ['corpo string de proxy', '<html>502</html>'],
  ])('cai no padrao quando o corpo e %s', (_rotulo, corpo) => {
    const erro = new HttpErrorResponse({ status: 409, error: corpo });
    expect(mensagemOnboardingErro(erro, PADRAO)).toBe(PADRAO);
  });

  it('cai no padrao para erro que nao e HttpErrorResponse', () => {
    expect(mensagemOnboardingErro(new Error('offline'), PADRAO)).toBe(PADRAO);
  });
});
