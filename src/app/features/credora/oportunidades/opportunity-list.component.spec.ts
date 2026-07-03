import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { OportunidadeResponse } from '../../../core/api/api.models';
import { AuthService } from '../../../core/auth/auth.service';
import { OpportunityListComponent } from './opportunity-list.component';

const URL = 'http://localhost:8080/api/v1/credores/oportunidades';
const authStub = { currentUser: signal(null), logout: async () => undefined };

function oportunidade(over: Partial<OportunidadeResponse> = {}): OportunidadeResponse {
  return {
    id: 'op-1',
    propostaId: 'proposta-secreta-123',
    contratoId: 'contrato-secreto-456',
    valor: 10000,
    prazoMeses: 12,
    taxaJurosMensal: 0.0199,
    status: 'DISPONIVEL',
    dataCriacao: '2026-06-30T09:00:00-03:00',
    ...over,
  };
}

describe('OpportunityListComponent', () => {
  let fixture: ComponentFixture<OpportunityListComponent>;
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
    fixture = TestBed.createComponent(OpportunityListComponent);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  async function render(): Promise<HTMLElement> {
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('lista itens com valor, taxa e data formatados e status', async () => {
    fixture.detectChanges();
    httpMock.expectOne(URL).flush([oportunidade()]);
    const el = await render();

    const item = el.querySelector('[data-testid="sep-oportunidade-item-op-1"]');
    expect(item).not.toBeNull();
    expect(item?.textContent).toContain('R$');
    expect(item?.textContent).toContain('1,99%');
    expect(item?.textContent).toContain('12 meses');
    expect(el.querySelector('[data-testid="sep-oportunidade-status"]')?.textContent).toContain(
      'Disponivel',
    );
  });

  it('lista vazia mostra estado neutro', async () => {
    fixture.detectChanges();
    httpMock.expectOne(URL).flush([]);
    const el = await render();
    expect(el.querySelector('[data-testid="sep-oportunidades-vazia"]')).not.toBeNull();
  });

  it('erro mostra retry', async () => {
    fixture.detectChanges();
    httpMock.expectOne(URL).flush('boom', { status: 500, statusText: 'Server Error' });
    const el = await render();
    expect(el.querySelector('[data-testid="sep-oportunidades-retry"]')).not.toBeNull();
  });

  it('nao expoe propostaId nem contratoId no DOM', async () => {
    fixture.detectChanges();
    httpMock.expectOne(URL).flush([oportunidade()]);
    const el = await render();
    expect(el.innerHTML).not.toContain('proposta-secreta-123');
    expect(el.innerHTML).not.toContain('contrato-secreto-456');
  });

  it('resposta obsoleta nao sobrescreve um refresh mais novo', async () => {
    fixture.detectChanges();
    const req1 = httpMock.expectOne(URL);

    // um refresh mais novo comeca antes de req1 responder
    void fixture.componentInstance.carregar();
    const req2 = httpMock.expectOne(URL);

    // o mais novo responde primeiro
    req2.flush([oportunidade({ id: 'novo', valor: 20000 })]);
    await fixture.whenStable();
    // o antigo responde depois: deve ser descartado
    req1.flush([oportunidade({ id: 'antigo', valor: 999 })]);
    const el = await render();

    expect(el.querySelector('[data-testid="sep-oportunidade-item-novo"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="sep-oportunidade-item-antigo"]')).toBeNull();
  });
});
