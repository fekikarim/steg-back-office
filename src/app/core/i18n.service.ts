import { Injectable, inject, signal, computed, PLATFORM_ID, Injector } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { DICTIONARIES, type SupportedLocale } from './dictionaries';
import { environment } from '../../environments/environment';

const STORAGE_KEY = 'steg-bo-locale';

/** Minimal institutional i18n: fr (default) / en / ar with true RTL via document.dir. All UI strings come from dictionaries. */
@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly injector = inject(Injector);
  readonly locale = signal<SupportedLocale>(this.readStored());
  readonly isRtl = computed(() => this.locale() === 'ar');
  /** Incremented on every language change so pure-pipe-free templates update. */
  readonly revision = signal(0);

  t(key: string, params?: Record<string, string | number>): string {
    // Depend on revision so components re-render after setLocale().
    this.revision();
    const dict = DICTIONARIES[this.locale()];
    let value = dict[key] ?? DICTIONARIES['fr'][key] ?? key;
    if (params) {
      for (const [k, v] of Object.entries(params)) value = value.replace(`{${k}}`, String(v));
    }
    return value;
  }

  setLocale(locale: SupportedLocale): void {
    this.locale.set(locale);
    this.revision.update((n) => n + 1);
    if (isPlatformBrowser(this.platformId)) {
      try {
        localStorage.setItem(STORAGE_KEY, locale);
      } catch {
        /* ignore */
      }
      document.documentElement.lang = locale;
      document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
      // Sync to backend for email notifications and future sessions (best-effort)
      try {
        const http = this.injector.get(HttpClient, null);
        const token = localStorage.getItem('steg-bo-access');
        if (http && token) {
          http
            .put(`${environment.apiBaseUrl}/api/users/me/locale`, { locale }, {})
            .subscribe({ error: () => {} });
        }
      } catch {
        /* ignore - offline or unauthenticated */
      }
    }
  }

  /** Call once at startup (App initializer) to apply persisted locale before paint. */
  applyInitial(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const locale = this.locale();
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
  }

  private readStored(): SupportedLocale {
    if (!isPlatformBrowser(this.platformId)) return 'fr';
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === 'fr' || raw === 'en' || raw === 'ar') return raw;
    } catch {
      /* ignore */
    }
    return 'fr';
  }
}
