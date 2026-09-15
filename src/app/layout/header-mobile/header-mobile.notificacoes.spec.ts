import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';

import { UsuarioResponse } from '../../core/api/api.models';
import { AuthService } from '../../core/auth/auth.service';
import {
  ContagemNaoLidas,
  NotificacoesNaoLidasStore,
} from '../../core/notificacoes/notificacoes-nao-lidas.store';
import { HeaderMobileComponent } from './header-mobile.component';

const cliente: UsuarioResponse = {
  id: '1f0799c0-98b9-6d9d-bc4a-7d6f5b771001',
  username: 'cliente@empresa.com',
  role: 'CLIENTE',
  dataCriacao: '2026-04-24T18:30:00-03:00',
  dataModificacao: '2026-04-24T18:30:00-03:00',
  criadoPor: 'system',
  modificadoPor: 'system',
  precisaRedefinirSenha: false,
  mfaHabilitado: false,
};

const BOTAO = '[data-testid="sep-header-mobile-notificacoes"]';
const MARCADOR = '[data-testid="sep-header-mobile-notificacoes-marcador"]';

function setup(
  contagemInicial: ContagemNaoLidas | null,
  usuario: UsuarioResponse | null = cliente,
) {
  const contagem = signal<ContagemNaoLidas | null>(contagemInicial);
  const carregar = vi.fn().mockResolvedValue(undefined);
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: { currentUser: signal(usuario), logout: vi.fn() } },
      { provide: NotificacoesNaoLidasStore, useValue: { contagem, carregar } },
    ],
  });
  const navSpy = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  const fixture = TestBed.createComponent(HeaderMobileComponent);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  return {
    fixture,
    contagem,
    carregar,
    navSpy,
    botao: () => el.querySelector<HTMLButtonElement>(BOTAO),
    marcador: () => el.querySelector<HTMLElement>(MARCADOR),
  };
}

describe('HeaderMobileComponent - acesso a central de notificacoes', () => {
  it('mostra o numero de nao lidas com rotulo textual por extenso', () => {
    const { botao, marcador } = setup({ situacao: 'conhecida', naoLidas: 3 });

    expect(botao()?.getAttribute('aria-label')).toBe('Notificacoes, 3 nao lidas');
    expect(marcador()?.textContent?.trim()).toBe('3');
    // O numero e decorativo para leitor de tela: o rotulo do botao ja o diz.
    expect(marcador()?.getAttribute('aria-hidden')).toBe('true');
  });

  it('usa o singular para uma nao lida', () => {
    const { botao } = setup({ situacao: 'conhecida', naoLidas: 1 });
    expect(botao()?.getAttribute('aria-label')).toBe('Notificacoes, 1 nao lida');
  });

  it('limita o marcador a 99+ sem truncar o rotulo', () => {
    const { botao, marcador } = setup({ situacao: 'conhecida', naoLidas: 150 });
    expect(marcador()?.textContent?.trim()).toBe('99+');
    expect(botao()?.getAttribute('aria-label')).toBe('Notificacoes, 150 nao lidas');
  });

  it('zero conhecido nao tem marcador e diz "nenhuma nao lida"', () => {
    const { botao, marcador } = setup({ situacao: 'conhecida', naoLidas: 0 });
    expect(marcador()).toBeNull();
    expect(botao()?.getAttribute('aria-label')).toBe('Notificacoes, nenhuma nao lida');
  });

  // Carregando e indisponivel nao podem ser anunciados como zero: quem nao ve o marcador so tem o
  // rotulo para distinguir "nao ha aviso" de "nao sei".
  it('carregando nao tem marcador e nao se anuncia como zero', () => {
    const { botao, marcador } = setup({ situacao: 'carregando' });
    expect(marcador()).toBeNull();
    expect(botao()?.getAttribute('aria-label')).toBe('Notificacoes, carregando contagem');
  });

  it('contagem ainda nao pedida para o usuario e tratada como carregando', () => {
    const { botao } = setup(null);
    expect(botao()?.getAttribute('aria-label')).toBe('Notificacoes, carregando contagem');
  });

  it('indisponivel tem marcador proprio, distinto de zero, e o botao continua acessivel', () => {
    const { botao, marcador } = setup({ situacao: 'indisponivel' });
    expect(marcador()?.textContent?.trim()).toBe('?');
    expect(marcador()?.getAttribute('data-situacao')).toBe('indisponivel');
    expect(botao()?.getAttribute('aria-label')).toBe('Notificacoes, contagem indisponivel');
    expect(botao()?.disabled).toBe(false);
  });

  it('o marcador de contagem conhecida nao usa o estilo de indisponivel', () => {
    const { marcador } = setup({ situacao: 'conhecida', naoLidas: 2 });
    expect(marcador()?.getAttribute('data-situacao')).toBe('conhecida');
  });

  it('acompanha a mudanca de contagem do store sem recriar o header', () => {
    const { fixture, contagem, botao, marcador } = setup({ situacao: 'conhecida', naoLidas: 2 });

    contagem.set({ situacao: 'conhecida', naoLidas: 1 });
    fixture.detectChanges();

    expect(marcador()?.textContent?.trim()).toBe('1');
    expect(botao()?.getAttribute('aria-label')).toBe('Notificacoes, 1 nao lida');
  });

  it('tocar no botao abre a central por rota', () => {
    const { botao, navSpy } = setup({ situacao: 'conhecida', naoLidas: 2 });
    botao()?.click();
    expect(navSpy).toHaveBeenCalledWith('/app/notificacoes');
  });

  // Quem dispara a consulta e o shell; um header por pagina cacheada pedindo de novo multiplicaria
  // as requisicoes a cada navegacao.
  it('o header nao pede contagem ao montar', () => {
    const { carregar } = setup({ situacao: 'carregando' });
    expect(carregar).not.toHaveBeenCalled();
  });

  it('sem usuario autenticado nao oferece o acesso', () => {
    const { botao } = setup(null, null);
    expect(botao()).toBeNull();
  });
});
