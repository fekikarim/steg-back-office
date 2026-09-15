import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { I18nService } from '../core/i18n.service';
import { AuthService } from '../core/auth.service';
import { AlertComponent } from '../shared/ui/alert.component';

@Component({
  selector: 'st-login',
  standalone: true,
  imports: [FormsModule, AlertComponent],
  template: `
    <main class="st-login">
      <section class="st-login__card" aria-labelledby="login-title">
        <img src="logo/logo-steg-1200x327.png" alt="STEG" class="st-login__logo" />
        <h1 id="login-title" class="st-login__title">{{ i18n.t('auth.login.title') }}</h1>
        <p class="st-login__sub">{{ i18n.t('auth.login.subtitle') }}</p>
        <form class="st-login__form" (ngSubmit)="submit()" #form="ngForm" novalidate>
          <label class="st-field">
            <span class="st-field__label">{{ i18n.t('auth.email') }} *</span>
            <input
              type="email"
              name="email"
              class="st-input"
              required
              email
              [(ngModel)]="email"
              autocomplete="username"
              dir="ltr"
              [attr.aria-invalid]="submitted && !email ? 'true' : null"
            />
            @if (submitted && !email) {
              <span class="st-field__error" role="alert">{{ i18n.t('auth.required') }}</span>
            }
          </label>
          <label class="st-field">
            <span class="st-field__label">{{ i18n.t('auth.password') }} *</span>
            <div class="st-password-wrap">
              <input
                [type]="showPassword ? 'text' : 'password'"
                name="password"
                class="st-input"
                required
                [(ngModel)]="password"
                autocomplete="current-password"
                dir="ltr"
                [attr.aria-invalid]="submitted && !password ? 'true' : null"
              />
              <button
                type="button"
                class="st-btn st-btn--text st-password-toggle"
                (click)="showPassword = !showPassword"
                [attr.aria-label]="
                  showPassword ? i18n.t('auth.hidePassword') : i18n.t('auth.showPassword')
                "
              >
                {{ showPassword ? i18n.t('auth.hidePassword') : i18n.t('auth.showPassword') }}
              </button>
            </div>
            @if (submitted && !password) {
              <span class="st-field__error" role="alert">{{ i18n.t('auth.required') }}</span>
            }
          </label>
          @if (errorMessage()) {
            <st-alert tone="error" [title]="i18n.t('auth.errorTitle')">{{
              errorMessage()
            }}</st-alert>
          }
          <button type="submit" class="st-btn st-btn--primary" [disabled]="busy()">
            @if (busy()) {
              <span class="st-spinner" aria-hidden="true"></span> {{ i18n.t('common.loading') }}
            } @else {
              {{ i18n.t('auth.submit') }}
            }
          </button>
        </form>
        <p class="st-login__hint">{{ i18n.t('auth.hint') }}</p>
      </section>
    </main>
  `,
  styles: [
    `
      .st-login {
        min-block-size: 100dvh;
        display: grid;
        place-items: center;
        padding: 1.5rem;
        background: var(--bg-page);
      }
      .st-login__card {
        inline-size: min(26rem, 100%);
        background: var(--bg-surface);
        border: 1px solid var(--border-subtle);
        border-radius: 0.9rem;
        padding: 1.75rem;
        box-shadow: var(--shadow-md);
      }
      .st-login__logo {
        inline-size: 9rem;
        block-size: auto;
        background: #fff;
        border-radius: 0.5rem;
        padding: 0.35rem 0.6rem;
        margin-block-end: 1rem;
      }
      .st-login__title {
        margin: 0;
        font-size: 1.25rem;
      }
      .st-login__sub {
        margin: 0.3rem 0 1.1rem;
        color: var(--text-secondary);
        font-size: 0.85rem;
      }
      .st-login__form {
        display: grid;
        gap: 0.8rem;
      }
      .st-password-wrap {
        display: flex;
        gap: 0.4rem;
        align-items: center;
      }
      .st-password-wrap .st-input {
        flex: 1;
      }
      .st-password-toggle {
        white-space: nowrap;
        font-size: 0.8rem;
      }
      .st-spinner {
        inline-size: 0.9rem;
        block-size: 0.9rem;
        border: 2px solid currentColor;
        border-inline-end-color: transparent;
        border-radius: 50%;
        display: inline-block;
        animation: st-spin 0.7s linear infinite;
      }
      @keyframes st-spin {
        to {
          transform: rotate(360deg);
        }
      }
      .st-login__hint {
        margin: 1rem 0 0;
        font-size: 0.78rem;
        color: var(--text-muted);
        text-align: center;
      }
      @media (max-width: 480px) {
        .st-login__card {
          padding: 1.2rem;
        }
      }
    `,
  ],
})
export class LoginComponent implements OnInit {
  readonly i18n = inject(I18nService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  email = '';
  password = '';
  showPassword = false;
  submitted = false;
  readonly busy = signal(false);
  readonly errorMessage = signal('');

  ngOnInit(): void {
    if (this.auth.isAuthenticated()) {
      const raw = this.route.snapshot.queryParamMap.get('returnTo');
      const target = isSafeReturnTo(raw) ? raw : '/dashboard';
      void this.router.navigateByUrl(target);
    }
  }

  submit(): void {
    this.submitted = true;
    this.errorMessage.set('');
    if (!this.email || !this.password) return;
    this.busy.set(true);
    this.auth.login(this.email.trim(), this.password).subscribe({
      next: () => {
        this.busy.set(false);
        // Navigation is handled inside AuthService (honors returnTo)
      },
      error: (err: unknown) => {
        this.busy.set(false);
        this.errorMessage.set(this.extractMessage(err));
      },
    });
  }

  private extractMessage(error: unknown): string {
    if (typeof error === 'object' && error !== null) {
      const httpErr = error as {
        error?: { message?: string; error?: string; fieldErrors?: unknown[] };
        status?: number;
        message?: string;
      };
      if (httpErr.error?.message) return httpErr.error.message;
      if (typeof httpErr.error?.error === 'string') return httpErr.error.error;
      if (httpErr.status === 401) return this.i18n.t('auth.invalidCredentials');
      if (httpErr.status === 423) return this.i18n.t('auth.accountLocked');
      if (httpErr.status === 429) return this.i18n.t('auth.tooManyAttempts');
      if (httpErr.message) return httpErr.message;
    }
    return this.i18n.t('auth.genericError');
  }
}

function isSafeReturnTo(value: string | null): value is string {
  if (!value) return false;
  const lower = value.toLowerCase().trim();
  if (lower.startsWith('//') || lower.startsWith('http:') || lower.startsWith('https:'))
    return false;
  if (value.includes(':') || value.includes('\\')) return false;
  return value.startsWith('/');
}
