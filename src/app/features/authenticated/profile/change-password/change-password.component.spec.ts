import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { UsuarioResponse } from '../../../../core/api/api.models';
import { AuthService } from '../../../../core/auth/auth.service';
import { UsuariosService } from '../../../../core/users/usuarios.service';
import { ChangePasswordComponent } from './change-password.component';

const cliente: UsuarioResponse = {
  id: '1f0799c0-98b9-6d9d-bc4a-7d6f5b771001',
  username: 'cliente@empresa.com',
  role: 'CLIENTE',
  dataCriacao: '2026-04-24T18:30:00-03:00',
  dataModificacao: '2026-04-24T18:30:00-03:00',
  criadoPor: 'system',
  modificadoPor: 'system',
};

function setup(user: UsuarioResponse | null) {
  const authStub = {
    currentUser: signal<UsuarioResponse | null>(user) as ReturnType<typeof signal>,
    loadingUser: signal(false) as ReturnType<typeof signal>,
  };
  const usuariosStub = { alterarSenha: vi.fn().mockResolvedValue(undefined) };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: authStub },
      { provide: UsuariosService, useValue: usuariosStub },
    ],
  });
  const fixture = TestBed.createComponent(ChangePasswordComponent);
  fixture.detectChanges();
  return { fixture, authStub, usuariosStub };
}

describe('ChangePasswordComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());
  afterEach(() => vi.restoreAllMocks());

  it('form invalido sem senha atual', () => {
    const { fixture } = setup(cliente);
    const cmp = fixture.componentInstance;
    cmp.form.setValue({ passwordAtual: '', novaSenha: '654321', confirmacaoNovaSenha: '654321' });
    expect(cmp.form.invalid).toBe(true);
    expect(cmp.form.controls.passwordAtual.hasError('required')).toBe(true);
  });

  it('nova senha exige exatamente 6 caracteres', () => {
    const { fixture } = setup(cliente);
    const cmp = fixture.componentInstance;
    cmp.form.setValue({
      passwordAtual: '123456',
      novaSenha: '12345',
      confirmacaoNovaSenha: '12345',
    });
    expect(cmp.form.controls.novaSenha.hasError('minlength')).toBe(true);
  });

  it('confirmacao diferente invalida o form', () => {
    const { fixture } = setup(cliente);
    const cmp = fixture.componentInstance;
    cmp.form.setValue({
      passwordAtual: '123456',
      novaSenha: '654321',
      confirmacaoNovaSenha: '111111',
    });
    expect(cmp.form.hasError('confirmacaoDiferente')).toBe(true);
  });

  it('submit valido chama UsuariosService.alterarSenha com id do usuario atual', async () => {
    const { fixture, usuariosStub } = setup(cliente);
    const cmp = fixture.componentInstance;
    cmp.form.setValue({
      passwordAtual: '123456',
      novaSenha: '654321',
      confirmacaoNovaSenha: '654321',
    });
    await cmp.submit();
    expect(usuariosStub.alterarSenha).toHaveBeenCalledWith(cliente.id, {
      passwordAtual: '123456',
      novaSenha: '654321',
    });
    expect(cmp.successMessage()).toContain('sucesso');
  });

  it('erro 400 do backend exibe mensagem amigavel', async () => {
    const { fixture, usuariosStub } = setup(cliente);
    usuariosStub.alterarSenha.mockRejectedValue(
      new HttpErrorResponse({
        status: 400,
        error: { message: 'Senha atual incorreta' },
      }),
    );
    const cmp = fixture.componentInstance;
    cmp.form.setValue({
      passwordAtual: 'wrong1',
      novaSenha: '654321',
      confirmacaoNovaSenha: '654321',
    });
    await cmp.submit();
    expect(cmp.errorMessage()).toBe('Senha atual incorreta');
    expect(cmp.successMessage()).toBeNull();
  });

  it('sem usuario atual, submit nao chama service', async () => {
    const { fixture, usuariosStub } = setup(null);
    const cmp = fixture.componentInstance;
    cmp.form.setValue({
      passwordAtual: '123456',
      novaSenha: '654321',
      confirmacaoNovaSenha: '654321',
    });
    await cmp.submit();
    expect(usuariosStub.alterarSenha).not.toHaveBeenCalled();
  });
});
