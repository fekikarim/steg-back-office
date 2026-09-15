import { Router, type CanActivateFn } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';
import type { Permission } from './roles';

/**
 * UX-convenience guards only. Backend remains the authorization authority;
 * every endpoint re-checks role/permission/ownership server-side.
 */
export function authGuard(): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router) as Router;
    if (auth.isAuthenticated()) return true;
    void router.navigate(['/login']);
    return false;
  };
}

export function permissionGuard(required: readonly Permission[]): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router) as Router;
    if (!auth.isAuthenticated()) {
      void router.navigate(['/login']);
      return false;
    }
    if (auth.hasAnyPermission(required)) return true;
    void router.navigate(['/forbidden']);
    return false;
  };
}
