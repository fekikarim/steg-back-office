import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { I18nService } from '../core/i18n.service';
import { AuthService } from '../core/auth.service';
import type { StaffRole } from '../core/roles';
import { StIconComponent } from '../shared/ui/icon.component';
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
            />
            @if (submitted && !email) {
              <span class="st-field__error" role="alert">{{ i18n.t('auth.required') }}</span>
            }
          </label>
          <label class="st-field">
            <span class="st-field__label">{{ i18n.t('auth.password') }} *</span>
            <input
              type="password"
              name="password"
              class="st-input"
              required
              [(ngModel)]="password"
              autocomplete="current-password"
              dir="ltr"
            />
            @if (submitted && !password) {
              <span class="st-field__error" role="alert">{{ i18n.t('auth.required') }}</span>
            }
          </label>
          <label class="st-field">
            <span class="st-field__label">{{ i18n.t('shell.role') }}</span>
            <select
              name="role"
              class="st-input"
              [(ngModel)]="role"
              aria-label="{{ i18n.t('shell.role') }}"
            >
              <option value="HR">{{ i18n.t('login.role.hr') }}</option>
              <option value="SUPERVISOR">{{ i18n.t('login.role.supervisor') }}</option>
              <option value="FINANCE">{{ i18n.t('login.role.finance') }}</option>
              <option value="DIRECTOR">{{ i18n.t('login.role.director') }}</option>
              <option value="ADMIN">{{ i18n.t('login.role.admin') }}</option>
            </select>
          </label>
          <button type="submit" class="st-btn st-btn--primary" [disabled]="busy">
            {{ i18n.t('auth.submit') }}
          </button>
        </form>
        <st-alert tone="info" style="margin-block-start: 1rem">{{ i18n.t('auth.demo') }}</st-alert>
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
    `,
  ],
})
export class LoginComponent implements OnInit {
  readonly i18n = inject(I18nService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  email = '';
  password = '';
  role: StaffRole = 'HR';
  submitted = false;
  busy = false;

  ngOnInit(): void {
    if (this.auth.isAuthenticated()) void this.router.navigate(['/dashboard']);
  }

  submit(): void {
    this.submitted = true;
    if (!this.email || !this.password) return;
    this.busy = true;
    // Demo sign-in; real IAM (JWT + refresh, httpOnly cookies) lands in Phase C6 via ApiClient.
    this.auth.signInDemo(this.email.trim(), this.role);
    this.busy = false;
  }
}
