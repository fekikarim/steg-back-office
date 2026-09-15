import { Injectable, signal, computed, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import type { StaffRole } from './roles';
import { permissionsFor, type Permission } from './roles';

export interface SessionUser {
  readonly email: string;
  readonly displayName: string;
  readonly role: StaffRole;
}

const STORAGE_KEY = 'steg-bo-session';

/**
 * Demo-capable session service. Against the real backend this exchanges
 * credentials for httpOnly-cookie session + short-lived JWT via ApiClient;
 * this build keeps tokens out of localStorage (in-memory only) and stores
 * only the display profile for shell UX. Backend remains authorization authority.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly router = inject(Router);

  private readonly _user = signal<SessionUser | null>(this.readStored());
  readonly user = this._user.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);
  readonly role = computed<StaffRole | null>(() => this._user()?.role ?? null);
  /** In-memory access token only — never persisted to storage. */
  private accessToken: string | null = null;

  hasPermission(permission: Permission): boolean {
    const role = this.role();
    if (!role) return false;
    return permissionsFor(role).includes(permission);
  }

  hasAnyPermission(permissions: readonly Permission[]): boolean {
    if (permissions.length === 0) return this.isAuthenticated();
    return permissions.some((p) => this.hasPermission(p));
  }

  /** Demo sign-in used until backend IAM is wired (Phase C6). Validates shape only. */
  signInDemo(email: string, role: StaffRole): void {
    const displayName =
      email
        .split('@')[0]
        ?.replace(/[._-]+/g, ' ')
        .trim() || email;
    this._user.set({ email, displayName, role });
    this.persist();
    void this.router.navigate(['/dashboard']);
  }

  signOut(returnUrl = '/login'): void {
    this._user.set(null);
    this.accessToken = null;
    if (isPlatformBrowser(this.platformId)) {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
    }
    void this.router.navigate([returnUrl]);
  }

  setAccessToken(token: string | null): void {
    this.accessToken = token;
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  private readStored(): SessionUser | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as SessionUser;
      if (typeof parsed.email === 'string' && typeof parsed.role === 'string') return parsed;
    } catch {
      /* ignore */
    }
    return null;
  }

  private persist(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const user = this._user();
    try {
      if (user) localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }
}
