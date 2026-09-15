import { Injectable, inject, signal, computed, PLATFORM_ID, effect } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type { ThemeMode, ResolvedTheme } from './tokens';

const STORAGE_KEY = 'steg-bo-theme';
const ATTR = 'data-theme';

/** Persistent light/dark/system theme using STEG semantic tokens. No page reload, no flash (see index.html inline script). */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly mediaQuery: MediaQueryList | null =
    isPlatformBrowser(this.platformId) && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-color-scheme: dark)')
      : null;

  readonly mode = signal<ThemeMode>(this.readStored());
  readonly systemDark = signal<boolean>(this.mediaQuery?.matches ?? false);
  readonly resolved = computed<ResolvedTheme>(() => {
    const m = this.mode();
    if (m === 'system') return this.systemDark() ? 'dark' : 'light';
    return m;
  });

  constructor() {
    if (this.mediaQuery) {
      this.mediaQuery.addEventListener('change', (e) => this.systemDark.set(e.matches));
    }
    this.apply(this.resolved());
    // Keep the DOM attribute in sync whenever the resolved theme changes.
    effect(() => {
      this.apply(this.resolved());
    });
  }

  setMode(mode: ThemeMode): void {
    this.mode.set(mode);
    if (isPlatformBrowser(this.platformId)) {
      try {
        localStorage.setItem(STORAGE_KEY, mode);
      } catch {
        /* storage unavailable: theme still applies for session */
      }
    }
    this.apply(this.resolved());
  }

  private readStored(): ThemeMode {
    if (!isPlatformBrowser(this.platformId)) return 'system';
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
    } catch {
      /* ignore */
    }
    return 'system';
  }

  private apply(resolved: ResolvedTheme): void {
    if (!isPlatformBrowser(this.platformId)) return;
    document.documentElement.setAttribute(ATTR, resolved);
    document.documentElement.style.colorScheme = resolved;
  }
}
