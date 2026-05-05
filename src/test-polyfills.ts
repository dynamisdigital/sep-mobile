// Polyfills para Web Streams APIs e BroadcastChannel sob jsdom/happy-dom.
// Atualmente NAO esta plugado em vitest.config.mts, mas fica pronto para a M-Sprint 2/3,
// quando o MSW server for plugado em src/test-setup.ts e os testes passarem a depender
// de fetch interceptors.

import { ReadableStream, TransformStream, WritableStream } from 'node:stream/web';
import { TextDecoder, TextEncoder } from 'node:util';

const g = globalThis as unknown as Record<string, unknown>;

g['TransformStream'] = g['TransformStream'] ?? TransformStream;
g['ReadableStream'] = g['ReadableStream'] ?? ReadableStream;
g['WritableStream'] = g['WritableStream'] ?? WritableStream;
g['TextEncoder'] = g['TextEncoder'] ?? TextEncoder;
g['TextDecoder'] = g['TextDecoder'] ?? TextDecoder;

if (typeof g['BroadcastChannel'] === 'undefined') {
  // Stub minimo — MSW so usa o construtor; nao precisamos de mensageria real nos testes.
  g['BroadcastChannel'] = class {
    name: string;
    constructor(name: string) {
      this.name = name;
    }
    postMessage() {
      /* noop */
    }
    close() {
      /* noop */
    }
    addEventListener() {
      /* noop */
    }
    removeEventListener() {
      /* noop */
    }
  };
}
