import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';

import { SessionExpiredComponent } from './session-expired.component';

describe('SessionExpiredComponent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideRouter([])],
    });
  });

  it('renderiza titulo e link para /welcome', () => {
    const fixture = TestBed.createComponent(SessionExpiredComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[data-testid="sep-session-expired-title"]')?.textContent).toContain(
      'Sessao expirada',
    );
    const link = el.querySelector('[data-testid="sep-session-expired-back"]');
    expect(link).not.toBeNull();
    expect(link?.textContent).toContain('welcome');
  });
});
