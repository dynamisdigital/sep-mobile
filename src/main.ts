import { provideHttpClient, withInterceptors } from '@angular/common/http';
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
import { authInterceptor } from './app/core/interceptors/auth.interceptor';
import { clientChannelInterceptor } from './app/core/interceptors/client-channel.interceptor';
import { errorInterceptor } from './app/core/interceptors/error.interceptor';
import { stepUpInterceptor } from './app/core/interceptors/step-up.interceptor';
import { environment } from './environments/environment';

async function prepare(): Promise<void> {
  const forceMsw =
    typeof window !== 'undefined' && window.localStorage?.getItem('NG_APP_USE_MSW') === 'true';

  if (environment.useMsw || forceMsw) {
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
      provideHttpClient(
        withInterceptors([
          clientChannelInterceptor,
          authInterceptor,
          stepUpInterceptor,
          errorInterceptor,
        ]),
      ),
    ],
  }).catch((err) => console.error(err)),
);
