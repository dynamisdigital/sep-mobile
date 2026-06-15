import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ThemeService } from './theme.service';

function createService(): ThemeService {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [ThemeService] });
  return TestBed.inject(ThemeService);
}

describe('ThemeService', () => {
  let root: HTMLElement;

  beforeEach(() => {
    root = TestBed.inject(DOCUMENT).documentElement;
    localStorage.clear();
    root.classList.remove('dark', 'ion-palette-dark');
  });

  afterEach(() => {
    localStorage.clear();
    root.classList.remove('dark', 'ion-palette-dark');
  });

  it('toggle alterna entre claro e escuro e aplica as classes no root', () => {
    const service = createService();
    expect(service.isDark()).toBe(false);

    service.toggle();
    expect(service.isDark()).toBe(true);
    expect(root.classList.contains('dark')).toBe(true);
    expect(root.classList.contains('ion-palette-dark')).toBe(true);

    service.toggle();
    expect(service.isDark()).toBe(false);
    expect(root.classList.contains('dark')).toBe(false);
  });

  it('setTheme persiste a preferencia em localStorage', () => {
    const service = createService();
    service.setTheme('dark');
    expect(localStorage.getItem('SEP_THEME')).toBe('dark');
  });

  it('tema inicial respeita o valor salvo em localStorage', () => {
    localStorage.setItem('SEP_THEME', 'dark');
    const service = createService();
    expect(service.isDark()).toBe(true);
    expect(root.classList.contains('dark')).toBe(true);
  });
});
