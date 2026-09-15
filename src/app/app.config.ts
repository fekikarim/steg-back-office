import {
  ApplicationConfig,
  APP_INITIALIZER,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { I18nService } from './core/i18n.service';
import { AuthService } from './core/auth.service';
import { authInterceptor } from './core/auth.interceptor';
import { i18nInterceptor } from './core/i18n.interceptor';
import { errorInterceptor } from './core/error.interceptor';

function initI18n(i18n: I18nService): () => void {
  return () => i18n.applyInitial();
}

function initAuth(auth: AuthService): () => void {
  return () => auth.restoreSession();
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([authInterceptor, i18nInterceptor, errorInterceptor])),
    { provide: APP_INITIALIZER, multi: true, useFactory: initI18n, deps: [I18nService] },
    { provide: APP_INITIALIZER, multi: true, useFactory: initAuth, deps: [AuthService] },
  ],
};
