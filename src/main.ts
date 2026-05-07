import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { bootstrapApplication } from '@angular/platform-browser';
import {
  PreloadAllModules,
  RouteReuseStrategy,
  provideRouter,
  withPreloading,
} from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular/standalone';

import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';

async function prepare(): Promise<void> {
  // MSW so dispara via flag em localStorage para evitar surpresa em builds prod.
  // Para ativar em dev: localStorage.setItem('NG_APP_USE_MSW', 'true') e recarregar.
  if (typeof window !== 'undefined' && window.localStorage?.getItem('NG_APP_USE_MSW') === 'true') {
    const { worker } = await import('./mocks/browser');
    await worker.start({ onUnhandledRequest: 'bypass' });
  }
}

prepare().then(() =>
  bootstrapApplication(AppComponent, {
    providers: [
      { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
      provideIonicAngular(),
      provideRouter(routes, withPreloading(PreloadAllModules)),
      provideHttpClient(withInterceptorsFromDi()),
    ],
  }).catch((err) => console.error(err)),
);
