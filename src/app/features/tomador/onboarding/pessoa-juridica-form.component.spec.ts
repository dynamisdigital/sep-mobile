import { EnvironmentInjector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { IniciarOnboardingEmpresaRequest } from '../../../core/api/api.models';
import { PessoaJuridicaFormComponent } from './pessoa-juridica-form.component';

// Ionic (ion-input/ion-select) nao monta no happy-dom; testamos a logica via instancia,
// seguindo a convencao do repo (login/register).
function build(): PessoaJuridicaFormComponent {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({});
  const injector = TestBed.inject(EnvironmentInjector);
  return runInInjectionContext(injector, () => new PessoaJuridicaFormComponent());
}

describe('PessoaJuridicaFormComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('exige apenas cnpj e razao social; tipo/porte/fantasia sao opcionais', () => {
    const form = build().form;
    expect(form.controls.cnpj.hasError('required')).toBe(true);
    expect(form.controls.razaoSocial.hasError('required')).toBe(true);
    // Backend aceita estes campos nulos (colunas nullable).
    expect(form.controls.tipoSocietario.hasError('required')).toBe(false);
    expect(form.controls.porte.hasError('required')).toBe(false);
    expect(form.controls.nomeFantasia.hasError('required')).toBe(false);
  });

  it('formulario invalido nao emite iniciar', () => {
    const component = build();
    const emitido = vi.fn();
    component.iniciar.subscribe(emitido);
    component.submit();
    expect(emitido).not.toHaveBeenCalled();
  });

  it('submit so com cnpj e razao social emite tipo/porte/fantasia como undefined', () => {
    const component = build();
    let emitido: IniciarOnboardingEmpresaRequest | undefined;
    component.iniciar.subscribe((p) => (emitido = p));
    component.form.patchValue({ cnpj: '12345678000190', razaoSocial: 'Acme Ltda' });
    component.submit();
    expect(emitido).toEqual({
      cnpj: '12345678000190',
      razaoSocial: 'Acme Ltda',
      nomeFantasia: undefined,
      tipoSocietario: undefined,
      porte: undefined,
    });
  });

  it('submit valido emite o payload PJ; nome fantasia vazio vira undefined', () => {
    const component = build();
    let emitido: IniciarOnboardingEmpresaRequest | undefined;
    component.iniciar.subscribe((p) => (emitido = p));
    component.form.setValue({
      cnpj: '12345678000190',
      razaoSocial: 'Acme Ltda',
      nomeFantasia: '',
      tipoSocietario: 'LTDA',
      porte: 'ME',
    });
    component.submit();
    expect(emitido).toEqual({
      cnpj: '12345678000190',
      razaoSocial: 'Acme Ltda',
      nomeFantasia: undefined,
      tipoSocietario: 'LTDA',
      porte: 'ME',
    });
  });
});
