import {
  type HttpInterceptorFn,
  type HttpErrorResponse,
  HttpContextToken,
  HttpRequest,
  HttpHandlerFn,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError, switchMap, Observable } from 'rxjs';
import { ToastService } from '../shared/ui/toast.service';
import { AuthService } from './auth.service';

/** Opt-out flag: per-request bypass of the global 401/403 redirect. */
export const SKIP_GLOBAL_ERROR = new HttpContextToken<boolean>(() => false);

let lastNavigationAt = 0;

/**
 * Central error mapping — user-safe toasts, no secrets in messages.
 * 401 → try silent refresh (if refresh token exists), otherwise → login
 * (with safe returnTo). 403 → forbidden. Both are throttled and
 * suppressible per-request via SKIP_GLOBAL_ERROR so role-scoped
 * dashboards can render "unavailable" instead of forcing a redirect.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const toast = inject(ToastService);

  // Requests that the caller will handle as dataset-level "unavailable".
  if (req.context.get(SKIP_GLOBAL_ERROR)) {
    return next(req);
  }

  // Auth endpoints themselves should never trigger a refresh loop
  const isAuthEndpoint =
    req.url.includes('/api/auth/login') ||
    req.url.includes('/api/auth/refresh') ||
    req.url.includes('/api/auth/register');

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      const now = Date.now();
      const throttled = now - lastNavigationAt < 800;
      const onAuthPage = router.url.startsWith('/login') || router.url.startsWith('/forbidden');
      const isDemoWithoutToken = !req.headers.has('Authorization');

      if (err.status === 401) {
        if (isAuthEndpoint) {
          return throwError(() => err);
        }
        // Demo or no token — let caller handle as unavailable/error
        if (isDemoWithoutToken) {
          return throwError(() => err);
        }
        // Try silent refresh — AuthService coalesces concurrent refreshes via shareReplay
        if (!onAuthPage) {
          const auth = inject(AuthService);
          if (!auth.getRefreshToken()) {
            if (!throttled) {
              lastNavigationAt = now;
              const returnTo = router.url !== '/login' ? router.url : undefined;
              void router.navigate(['/login'], { queryParams: returnTo ? { returnTo } : {} });
            }
            return throwError(() => err);
          }
          return auth.refresh().pipe(
            switchMap(() => {
              const newToken = auth.getAccessToken();
              if (!newToken) {
                return throwError(() => err);
              }
              const cloned = req.clone({
                setHeaders: { Authorization: `Bearer ${newToken}` },
              });
              return next(cloned);
            }),
            catchError((refreshErr) => {
              if (!onAuthPage && !throttled) {
                lastNavigationAt = now;
                const returnTo = router.url !== '/login' ? router.url : undefined;
                void router.navigate(['/login'], {
                  queryParams: returnTo ? { returnTo } : {},
                });
              }
              return throwError(() => refreshErr);
            }),
          ) as Observable<never>;
        }
      } else if (err.status === 403) {
        if (!onAuthPage && !throttled) {
          toast.show('error', 'Accès restreint — le backend a refusé cette action.');
          lastNavigationAt = now;
          void router.navigate(['/forbidden']);
        } else if (!throttled) {
          toast.show('error', 'Accès restreint — le backend a refusé cette action.');
        }
      } else if (err.status >= 500) {
        toast.show('error', 'Erreur serveur. Réessayez ou contactez le support.');
      } else if (err.status === 423) {
        toast.show('error', 'Compte verrouillé — veuillez réessayer plus tard.');
      } else if (err.status === 429) {
        toast.show('error', 'Trop de tentatives — veuillez patienter.');
      }
      return throwError(() => err);
    }),
  );
};
