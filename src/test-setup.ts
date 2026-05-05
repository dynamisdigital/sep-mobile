import '@angular/compiler';
import '@analogjs/vitest-angular/setup-zone';
import '@testing-library/jest-dom/vitest';

import { getTestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';

getTestBed().initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting(), {
  teardown: { destroyAfterEach: true },
});

// MSW server (mocks/server.ts) sera plugado aqui na M-Sprint 2/3, quando os primeiros
// testes que dependem da API entrarem. Por ora os handlers estao prontos em src/mocks/
// e a integracao via worker (browser) esta funcional em dev (gate runtime via
// localStorage). Polyfills Web Streams + BroadcastChannel ja estao prontos em
// src/test-polyfills.ts para ativacao futura.
