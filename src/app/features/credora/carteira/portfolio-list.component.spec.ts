import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { OperacaoCarteiraResponse } from '../../../core/api/api.models';
import { AuthService } from '../../../core/auth/auth.service';
import { PortfolioListComponent } from './portfolio-list.component';

const URL = 'http://localhost:8080/api/v1/credores/carteira';
const authStub = { currentUser: signal(null), logout: async () => undefined };

function operacao(over: Partial<OperacaoCarteiraResponse> = {}): OperacaoCarteiraResponse {
  return {
    id: 'op-1',
    contratoId: 'contrato-secreto-123',
    oportunidadeId: 'oportunidade-secreta-456',
    status: 'ASSOCIADA',
    justificativa: 'justificativa-secreta-operacional',
    valor: 10000,
    prazoMeses: 12,
    taxaJurosMensal: 0.0199,
    contratoStatus: 'ASSINADO',
    cobranca: null,
    dataCriacao: '2026-06-30T09:00:00-03:00',
    ...over,
  };
}

describe('PortfolioListComponent', () => {
  let fixture: ComponentFixture<PortfolioListComponent>;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: authStub },
      ],
    });
    fixture = TestBed.createComponent(PortfolioListComponent);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  async function render(): Promise<HTMLElement> {
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('lista operacoes com valor, taxa e status', async () => {
    fixture.detectChanges();
    httpMock.expectOne(URL).flush([operacao()]);
    const el = await render();

    const item = el.querySelector('[data-testid="sep-operacao-item-op-1"]');
    expect(item?.textContent).toContain('R$');
    expect(item?.textContent).toContain('1,99%');
    expect(el.querySelector('[data-testid="sep-operacao-status"]')?.textContent).toContain(
      'Associada',
    );
  });

  it('lista vazia explica que interesse nao gera carteira', async () => {
    fixture.detectChanges();
    httpMock.expectOne(URL).flush([]);
    const el = await render();
    const vazia = el.querySelector('[data-testid="sep-carteira-vazia"]');
    expect(vazia).not.toBeNull();
    expect(vazia?.textContent).toContain('nao gera carteira');
  });

  it('campos nullable viram "Nao informado" sem zero inventado', async () => {
    fixture.detectChanges();
    httpMock
      .expectOne(URL)
      .flush([operacao({ valor: null, prazoMeses: null, taxaJurosMensal: null })]);
    const el = await render();
    const item = el.querySelector('[data-testid="sep-operacao-item-op-1"]');
    expect(item?.textContent).toContain('Nao informado');
    expect(item?.textContent).not.toContain('R$ 0');
  });

  it('erro mostra retry', async () => {
    fixture.detectChanges();
    httpMock.expectOne(URL).flush('boom', { status: 500, statusText: 'Server Error' });
    const el = await render();
    expect(el.querySelector('[data-testid="sep-carteira-retry"]')).not.toBeNull();
  });

  it('nao expoe IDs internos nem justificativa', async () => {
    fixture.detectChanges();
    httpMock.expectOne(URL).flush([operacao()]);
    const el = await render();
    expect(el.innerHTML).not.toContain('contrato-secreto-123');
    expect(el.innerHTML).not.toContain('oportunidade-secreta-456');
    expect(el.innerHTML).not.toContain('justificativa-secreta-operacional');
  });

  it('resposta obsoleta nao sobrescreve um refresh mais novo', async () => {
    fixture.detectChanges();
    const req1 = httpMock.expectOne(URL);
    void fixture.componentInstance.carregar();
    const req2 = httpMock.expectOne(URL);

    req2.flush([operacao({ id: 'novo' })]);
    await fixture.whenStable();
    req1.flush([operacao({ id: 'antigo' })]);
    const el = await render();

    expect(el.querySelector('[data-testid="sep-operacao-item-novo"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="sep-operacao-item-antigo"]')).toBeNull();
  });
});
