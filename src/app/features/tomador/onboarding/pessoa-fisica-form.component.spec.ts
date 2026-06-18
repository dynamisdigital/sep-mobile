import { EnvironmentInjector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { IniciarOnboardingPessoaRequest } from '../../../core/api/api.models';
import { PessoaFisicaFormComponent } from './pessoa-fisica-form.component';

// Ionic (ion-input) nao monta no happy-dom; seguimos a convencao do repo (login/register)
// testando a logica do componente via instancia, sem renderizar o template.
function build(): PessoaFisicaFormComponent {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({});
  const injector = TestBed.inject(EnvironmentInjector);
  return runInInjectionContext(injector, () => new PessoaFisicaFormComponent());
}

describe('PessoaFisicaFormComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('declara os campos obrigatorios de PF', () => {
    const form = build().form;
    expect(form.contains('cpf')).toBe(true);
    expect(form.contains('nomeCompleto')).toBe(true);
    expect(form.contains('dataNascimento')).toBe(true);
    expect(form.controls.cpf.hasError('required')).toBe(true);
    expect(form.controls.nomeCompleto.hasError('required')).toBe(true);
    expect(form.controls.dataNascimento.hasError('required')).toBe(true);
  });

  it('formulario invalido nao emite iniciar', () => {
    const component = build();
    const emitido = vi.fn();
    component.iniciar.subscribe(emitido);
    component.submit();
    expect(emitido).not.toHaveBeenCalled();
  });

  it('cpf fora do formato basico mantem o form invalido', () => {
    const component = build();
    component.form.patchValue({ cpf: '123', nomeCompleto: 'Maria', dataNascimento: '1990-05-12' });
    expect(component.form.controls.cpf.valid).toBe(false);
  });

  it('submit valido emite o payload PF', () => {
    const component = build();
    let emitido: IniciarOnboardingPessoaRequest | undefined;
    component.iniciar.subscribe((p) => (emitido = p));
    component.form.setValue({
      cpf: '12345678901',
      nomeCompleto: 'Maria da Silva',
      dataNascimento: '1990-05-12',
    });
    component.submit();
    expect(emitido).toEqual({
      cpf: '12345678901',
      nomeCompleto: 'Maria da Silva',
      dataNascimento: '1990-05-12',
    });
  });
});
