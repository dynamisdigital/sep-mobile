import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { UsuariosService } from './usuarios.service';

const API = 'http://localhost:8080/api/v1';
const userId = '1f0799c0-98b9-6d9d-bc4a-7d6f5b771001';

describe('UsuariosService', () => {
  let service: UsuariosService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(UsuariosService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('alterarSenha PATCH /usuarios/{id}/senha com payload correto', async () => {
    const promise = service.alterarSenha(userId, {
      passwordAtual: '123456',
      novaSenha: '654321',
    });
    const req = httpMock.expectOne(`${API}/usuarios/${userId}/senha`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ passwordAtual: '123456', novaSenha: '654321' });
    req.flush(null, { status: 204, statusText: 'No Content' });
    await promise;
  });

  it('alterarSenha propaga erro 400 do backend', async () => {
    const promise = service.alterarSenha(userId, {
      passwordAtual: 'wrong1',
      novaSenha: '654321',
    });
    const req = httpMock.expectOne(`${API}/usuarios/${userId}/senha`);
    req.flush({ message: 'Senha atual incorreta' }, { status: 400, statusText: 'Bad Request' });
    await expect(promise).rejects.toBeDefined();
  });

  it('alterarSenha propaga erro 403 do backend', async () => {
    const promise = service.alterarSenha(userId, {
      passwordAtual: '123456',
      novaSenha: '654321',
    });
    const req = httpMock.expectOne(`${API}/usuarios/${userId}/senha`);
    req.flush({ message: 'Forbidden' }, { status: 403, statusText: 'Forbidden' });
    await expect(promise).rejects.toBeDefined();
  });
});
