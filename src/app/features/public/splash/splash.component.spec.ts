import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from '../../../core/auth/auth.service';
import { SPLASH_DELAY_MS, SplashComponent } from './splash.component';

describe('SplashComponent', () => {
  let routerSpy: { navigateByUrl: ReturnType<typeof vi.fn> };
  let authSpy: { loadCurrentUser: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    TestBed.resetTestingModule();
    routerSpy = { navigateByUrl: vi.fn().mockResolvedValue(true) };
    authSpy = { loadCurrentUser: vi.fn().mockResolvedValue(null) };
    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: routerSpy },
        { provide: AuthService, useValue: authSpy },
      ],
    });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renderiza marca SEP', () => {
    const fixture = TestBed.createComponent(SplashComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('SEP');
  });

  it('sem token navega para /welcome', async () => {
    const fixture = TestBed.createComponent(SplashComponent);
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(SPLASH_DELAY_MS + 10);
    await Promise.resolve();
    expect(authSpy.loadCurrentUser).toHaveBeenCalled();
    expect(routerSpy.navigateByUrl).toHaveBeenCalledWith('/welcome');
  });

  it('com token invalido tenta carregar usuario e navega para /welcome', async () => {
    authSpy.loadCurrentUser.mockResolvedValue(null);
    const fixture = TestBed.createComponent(SplashComponent);
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(SPLASH_DELAY_MS + 10);
    await Promise.resolve();
    expect(authSpy.loadCurrentUser).toHaveBeenCalled();
    expect(routerSpy.navigateByUrl).toHaveBeenCalledWith('/welcome');
  });
});
