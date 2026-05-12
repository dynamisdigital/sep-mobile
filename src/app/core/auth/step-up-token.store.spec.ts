import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { StepUpTokenStore } from './step-up-token.store';

describe('StepUpTokenStore', () => {
  let store: StepUpTokenStore;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    store = TestBed.inject(StepUpTokenStore);
  });

  it('hasToken e false por padrao', () => {
    expect(store.hasToken()).toBe(false);
    expect(store.consume()).toBeNull();
  });

  it('set + hasToken + consume devolve uma unica vez', () => {
    store.set('abc');
    expect(store.hasToken()).toBe(true);

    expect(store.consume()).toBe('abc');
    expect(store.hasToken()).toBe(false);
    expect(store.consume()).toBeNull();
  });

  it('clear zera o token sem retornar', () => {
    store.set('xyz');
    store.clear();
    expect(store.hasToken()).toBe(false);
  });
});
