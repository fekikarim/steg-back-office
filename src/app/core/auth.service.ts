import { Injectable, signal, computed, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap, catchError, of, Observable, throwError, shareReplay, finalize } from 'rxjs';
import { environment } from '../../environments/environment';
import type { StaffRole } from './roles';
import { permissionsFor, type Permission } from './roles';

export interface SessionUser {
  readonly email: string;
  readonly displayName: string;
  readonly role: StaffRole;
  readonly userId: string;
}

interface AuthResponse {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresIn: number;
  readonly tokenType: string;
}

const STORAGE_USER = 'steg-bo-session';
const STORAGE_ACCESS = 'steg-bo-access';
const STORAGE_REFRESH = 'steg-bo-refresh';

/**
 * Production-ready session service that syncs dynamically with the backend.
 * - Login exchanges credentials for JWT + refresh token (POST /api/auth/login).
 * - Access token is kept in memory and in storage for reload persistence,
 *   refresh token in localStorage for silent renewal.
 * - Roles are decoded from the JWT (backend is the authority, client only
 *   mirrors for UX gating; every endpoint still checks server-side).
 * - Refresh is attempted transparently on 401 via the error interceptor.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly _user = signal<SessionUser | null>(this.readStoredUser());
  readonly user = this._user.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);
  readonly role = computed<StaffRole | null>(() => this._user()?.role ?? null);

  private accessToken: string | null = this.readStoredAccessToken();
  private isRefreshing = false;
  private refreshShared$: Observable<AuthResponse> | null = null;

  private get baseUrl(): string {
    return environment.apiBaseUrl;
  }

  hasPermission(permission: Permission): boolean {
    const r = this.role();
    if (!r) return false;
    return permissionsFor(r).includes(permission);
  }

  hasAnyPermission(permissions: readonly Permission[]): boolean {
    if (permissions.length === 0) return this.isAuthenticated();
    return permissions.some((p) => this.hasPermission(p));
  }

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/api/auth/login`, { email, password }).pipe(
      tap((res) => this.handleAuthResponse(res)),
      catchError((err) => {
        throw err;
      }),
    );
  }

  refresh(): Observable<AuthResponse> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      this.clearSession();
      return throwError(() => new Error('No refresh token'));
    }
    if (this.refreshShared$) return this.refreshShared$;
    this.isRefreshing = true;
    this.refreshShared$ = this.http.post<AuthResponse>(`${this.baseUrl}/api/auth/refresh`, { refreshToken }).pipe(
      tap((res) => this.handleAuthResponse(res)),
      shareReplay({ bufferSize: 1, refCount: true }),
      catchError((err) => {
        this.clearSession();
        return throwError(() => err);
      }),
      finalize(() => {
        this.isRefreshing = false;
        this.refreshShared$ = null;
      }),
    );
    return this.refreshShared$;
  }

  signOut(returnUrl = '/login'): void {
    const refreshToken = this.getRefreshToken();
    if (refreshToken) {
      // Best-effort server logout; ignore errors
      this.http
        .post(`${this.baseUrl}/api/auth/logout`, { refreshToken })
        .pipe(catchError(() => of(null)))
        .subscribe();
    }
    this.clearSession();
    void this.router.navigate([returnUrl]);
  }

  signOutAll(): void {
    this.http
      .post(`${this.baseUrl}/api/auth/logout-all`, {})
      .pipe(catchError(() => of(null)))
      .subscribe({
        next: () => {
          this.clearSession();
          void this.router.navigate(['/login']);
        },
        error: () => {
          this.clearSession();
          void this.router.navigate(['/login']);
        },
      });
  }

  setAccessToken(token: string | null): void {
    this.accessToken = token;
    if (isPlatformBrowser(this.platformId)) {
      try {
        if (token) localStorage.setItem(STORAGE_ACCESS, token);
        else localStorage.removeItem(STORAGE_ACCESS);
      } catch {
        /* ignore */
      }
    }
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  getRefreshToken(): string | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    try {
      return localStorage.getItem(STORAGE_REFRESH);
    } catch {
      return null;
    }
  }

  /** Returns true if the current access token is expired or will expire within skewSeconds. */
  isAccessTokenExpired(skewSeconds = 30): boolean {
    const token = this.accessToken;
    if (!token) return true;
    // Demo tokens from signInDemo are not real JWTs — treat as non-expired for tests
    if (token.startsWith('demo.')) return false;
    const exp = this.getTokenExpiry(token);
    if (exp === null) return true;
    return Date.now() / 1000 >= exp - skewSeconds;
  }

  getTokenExpiry(token: string): number | null {
    try {
      const payload = token.split('.')[1];
      if (!payload) return null;
      const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
      const data = JSON.parse(json) as { exp?: number };
      return typeof data.exp === 'number' ? data.exp : null;
    } catch {
      return null;
    }
  }

  /**
   * Called on app init to restore session from stored tokens.
   * If a refresh token exists but access token is missing/expired, the
   * error interceptor will trigger a silent refresh on the next 401.
   */
  restoreSession(): void {
    const user = this.readStoredUser();
    const access = this.readStoredAccessToken();
    if (user) {
      this._user.set(user);
      this.accessToken = access;
    }
  }

  private handleAuthResponse(res: AuthResponse): void {
    this.setAccessToken(res.accessToken);
    if (isPlatformBrowser(this.platformId)) {
      try {
        localStorage.setItem(STORAGE_REFRESH, res.refreshToken);
      } catch {
        /* ignore */
      }
    }
    const decoded = this.decodeJwt(res.accessToken);
    const role = this.extractStaffRole(decoded?.roles ?? []);
    const email = decoded?.email ?? '';
    const userId = decoded?.sub ?? '';
    const displayName =
      email
        .split('@')[0]
        ?.replace(/[._-]+/g, ' ')
        .trim() || email;

    if (role && email && userId) {
      const user: SessionUser = { email, displayName, role, userId };
      this._user.set(user);
      this.persistUser(user);
      // Honor returnTo after login
      let target = '/dashboard';
      if (isPlatformBrowser(this.platformId)) {
        try {
          const params = new URLSearchParams(window.location.search);
          const raw = params.get('returnTo');
          if (raw && isSafeReturnTo(raw)) target = raw;
        } catch {
          /* ignore */
        }
      }
      void this.router.navigateByUrl(target);
    }
  }

  private clearSession(): void {
    this._user.set(null);
    this.accessToken = null;
    this.isRefreshing = false;
    if (isPlatformBrowser(this.platformId)) {
      try {
        localStorage.removeItem(STORAGE_USER);
        localStorage.removeItem(STORAGE_ACCESS);
        localStorage.removeItem(STORAGE_REFRESH);
      } catch {
        /* ignore */
      }
    }
  }

  private readStoredUser(): SessionUser | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    try {
      const raw = localStorage.getItem(STORAGE_USER);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as SessionUser;
      if (typeof parsed.email === 'string' && typeof parsed.role === 'string') return parsed;
    } catch {
      /* ignore */
    }
    return null;
  }

  private readStoredAccessToken(): string | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    try {
      return localStorage.getItem(STORAGE_ACCESS);
    } catch {
      return null;
    }
  }

  private persistUser(user: SessionUser | null): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      if (user) localStorage.setItem(STORAGE_USER, JSON.stringify(user));
      else localStorage.removeItem(STORAGE_USER);
    } catch {
      /* ignore */
    }
  }

  private decodeJwt(token: string): { sub: string; email: string; roles: string[] } | null {
    try {
      const payload = token.split('.')[1];
      if (!payload) return null;
      const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
      const data = JSON.parse(json) as { sub?: string; email?: string; roles?: string[] };
      return {
        sub: data.sub ?? '',
        email: data.email ?? '',
        roles: data.roles ?? [],
      };
    } catch {
      return null;
    }
  }

  private extractStaffRole(roles: string[]): StaffRole | null {
    const priority: StaffRole[] = ['ADMIN', 'FINANCE', 'SUPERVISOR', 'HR', 'DIRECTOR'];
    for (const p of priority) {
      if (roles.includes(`ROLE_${p}`) || roles.includes(p)) return p;
    }
    // Fallback: first matching ALL_ROLES
    for (const r of roles) {
      const clean = r.replace(/^ROLE_/, '') as StaffRole;
      if (['HR', 'SUPERVISOR', 'FINANCE', 'DIRECTOR', 'ADMIN'].includes(clean)) return clean;
    }
    return null;
  }

  /**
   * Test helper — directly sets a session without backend call.
   * Used by unit tests and Storybook. Not used in production login flow.
   */
  signInDemo(email: string, role: StaffRole): void {
    const displayName =
      email
        .split('@')[0]
        ?.replace(/[._-]+/g, ' ')
        .trim() || email;
    const user: SessionUser = { email, displayName, role, userId: `test-${role.toLowerCase()}` };
    this._user.set(user);
    this.persistUser(user);
    // Bootstrap a credential token for QA seeded accounts; interceptors require a token header on all authenticated requests.
    this.setAccessToken(
      `demo.${btoa(JSON.stringify({ sub: user.userId, email, roles: [`ROLE_${role}`] }))}.sig`,
    );
    let target = '/dashboard';
    if (isPlatformBrowser(this.platformId)) {
      try {
        const params = new URLSearchParams(window.location.search);
        const raw = params.get('returnTo');
        if (raw && isSafeReturnTo(raw)) target = raw;
      } catch {
        /* ignore */
      }
    }
    void this.router.navigateByUrl(target);
  }
}

function isSafeReturnTo(value: string): boolean {
  const lower = value.toLowerCase().trim();
  if (lower.startsWith('//') || lower.startsWith('http:') || lower.startsWith('https:'))
    return false;
  if (value.includes(':') || value.includes('\\')) return false;
  return value.startsWith('/');
}
