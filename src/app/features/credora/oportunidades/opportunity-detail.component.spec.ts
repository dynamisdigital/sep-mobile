import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { OportunidadeResponse } from '../../../core/api/api.models';
import { AuthService } from '../../../core/auth/auth.service';
import { OpportunityDetailComponent } from './opportunity-detail.component';

const ID = 'op-1';
const URL = `http://localhost:8080/api/v1/credores/oportunidades/${ID}`;
const authStub = { currentUser: signal(null), logout: async () => undefined };

function oportunidade(over: Partial<OportunidadeResponse> = {}): OportunidadeResponse {
  return {
    id: ID,
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

describe('OpportunityDetailComponent', () => {
  let fixture: ComponentFixture<OpportunityDetailComponent>;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: authStub },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ oportunidadeId: ID }) } },
        },
      ],
    });
    fixture = TestBed.createComponent(OpportunityDetailComponent);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  async function render(): Promise<HTMLElement> {
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('exibe valor, taxa e status da oportunidade', async () => {
    fixture.detectChanges();
    httpMock.expectOne(URL).flush(oportunidade());
    const el = await render();

    expect(
      el.querySelector('[data-testid="sep-oportunidade-detalhe-valor"]')?.textContent,
    ).toContain('R$');
    expect(
      el.querySelector('[data-testid="sep-oportunidade-detalhe-taxa"]')?.textContent,
    ).toContain('1,99%');
    expect(el.querySelector('[data-testid="sep-oportunidade-status"]')?.textContent).toContain(
      'Disponivel',
    );
  });

  it('404 mostra mensagem neutra e retorno para lista', async () => {
    fixture.detectChanges();
    httpMock.expectOne(URL).flush({ message: 'x' }, { status: 404, statusText: 'Not Found' });
    const el = await render();

    expect(
      el.querySelector('[data-testid="sep-oportunidade-detalhe-erro"]')?.textContent,
    ).toContain('indisponivel');
    expect(el.querySelector('[data-testid="sep-oportunidade-detalhe-voltar"]')).not.toBeNull();
  });

  it('encerrada nao oferece acao de interesse', async () => {
    fixture.detectChanges();
    httpMock.expectOne(URL).flush(oportunidade({ status: 'ENCERRADA' }));
    const el = await render();

    expect(el.querySelector('[data-testid="sep-oportunidade-detalhe-encerrada"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="sep-oportunidade-status"]')?.textContent).toContain(
      'Encerrada',
    );
  });

  it('erro tecnico mostra retry', async () => {
    fixture.detectChanges();
    httpMock.expectOne(URL).flush('boom', { status: 500, statusText: 'Server Error' });
    const el = await render();
    expect(el.querySelector('[data-testid="sep-oportunidade-detalhe-retry"]')).not.toBeNull();
  });

  it('nao expoe propostaId nem contratoId no DOM', async () => {
    fixture.detectChanges();
    httpMock.expectOne(URL).flush(oportunidade());
    const el = await render();
    expect(el.innerHTML).not.toContain('proposta-secreta-123');
    expect(el.innerHTML).not.toContain('contrato-secreto-456');
  });

  it('reentrada na stack reconsulta a oportunidade', async () => {
    fixture.detectChanges();
    httpMock.expectOne(URL).flush(oportunidade());
    await render();

    // reentrada via ion-router-outlet: novo fetch
    fixture.componentInstance.ionViewWillEnter();
    httpMock.expectOne(URL).flush(oportunidade({ status: 'ENCERRADA' }));
    const el = await render();
    expect(el.querySelector('[data-testid="sep-oportunidade-detalhe-encerrada"]')).not.toBeNull();
  });
});
