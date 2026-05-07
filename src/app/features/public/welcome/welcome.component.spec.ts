import { describe, expect, it } from 'vitest';

import { WelcomeComponent } from './welcome.component';

// Ionic web components quebram em happy-dom por CSSStyleSheet.replaceSync.
// Padrao adotado nesta trilha (M-Sprint 1 / M-Sprint 0): smoke check sem montar template.
// Cobertura visual fica em e2e Playwright + DevTools mobile viewport.
describe('WelcomeComponent', () => {
  it('classe esta definida', () => {
    expect(WelcomeComponent).toBeDefined();
  });
});
