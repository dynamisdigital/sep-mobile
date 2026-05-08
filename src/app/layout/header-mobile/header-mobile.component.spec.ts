import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UsuarioResponse } from '../../core/api/api.models';
import { AuthService } from '../../core/auth/auth.service';
import { HeaderMobileComponent } from './header-mobile.component';

const usuario: UsuarioResponse = {
  id: '1f0799c0-98b9-6d9d-bc4a-7d6f5b771001',
  username: 'cliente@empresa.com',
  role: 'CLIENTE',
  dataCriacao: '2026-04-24T18:30:00-03:00',
  dataModificacao: '2026-04-24T18:30:00-03:00',
  criadoPor: 'system',
  modificadoPor: 'system',
};

describe('HeaderMobileComponent', () => {
  let fixture: ComponentFixture<HeaderMobileComponent>;
  let component: HeaderMobileComponent;
  let authStub: {
    currentUser: ReturnType<typeof signal>;
    logout: ReturnType<typeof vi.fn>;
  };
  let routerStub: { navigateByUrl: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    authStub = {
      currentUser: signal<UsuarioResponse | null>(usuario) as ReturnType<typeof signal>,
      logout: vi.fn().mockResolvedValue(undefined),
    };
    routerStub = { navigateByUrl: vi.fn().mockResolvedValue(true) };
    await TestBed.configureTestingModule({
      imports: [HeaderMobileComponent],
      providers: [
        { provide: AuthService, useValue: authStub },
        { provide: Router, useValue: routerStub },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(HeaderMobileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renderiza email do usuario autenticado', () => {
    const el: HTMLElement = fixture.nativeElement;
    const email = el.querySelector('[data-testid="sep-header-mobile-email"]');
    expect(email?.textContent?.trim()).toBe(usuario.username);
  });

  it('logout chama AuthService.logout e redireciona /welcome', async () => {
    await component.logout();
    expect(authStub.logout).toHaveBeenCalled();
    expect(routerStub.navigateByUrl).toHaveBeenCalledWith('/welcome');
  });

  it('userRole reflete role do usuario', () => {
    expect(component.userRole()).toBe('CLIENTE');
  });
});
