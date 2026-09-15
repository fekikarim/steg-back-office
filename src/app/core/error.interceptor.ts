import type { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { ToastService } from '../shared/ui/toast.service';

/** Central error mapping: 401 → login, 403 → forbidden, else user-safe toast. No secrets in messages. */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const toast = inject(ToastService);
  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401) {
        void router.navigate(['/login'], { queryParams: { returnTo: router.url } });
      } else if (err.status === 403) {
        toast.show('error', 'Accès restreint — le backend a refusé cette action.');
        void router.navigate(['/forbidden']);
      } else if (err.status >= 500) {
        toast.show('error', 'Erreur serveur. Réessayez ou contactez le support.');
      }
      return throwError(() => err);
    }),
  );
};
