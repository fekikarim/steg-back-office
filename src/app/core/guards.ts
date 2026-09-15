import { Router, type CanActivateFn } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';
import type { Permission } from './roles';

/**
 * UX-convenience guards only. Backend remains the authorization authority;
 * every endpoint re-checks role/permission/ownership server-side.
 * Guards return UrlTree (no side-effect navigate) so the router handles
 * the redirect exactly once — avoids navigation-loop edge cases.
 */
export function authGuard(): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    if (auth.isAuthenticated()) return true;
    return router.createUrlTree(['/login'], {
      queryParams: { returnTo: router.url !== '/login' ? router.url : undefined },
    });
  };
}

export function permissionGuard(required: readonly Permission[]): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    if (!auth.isAuthenticated()) {
      return router.createUrlTree(['/login'], {
        queryParams: { returnTo: router.url !== '/login' ? router.url : undefined },
      });
    }
    if (auth.hasAnyPermission(required)) return true;
    return router.createUrlTree(['/forbidden']);
  };
}
