import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { I18nService } from '../core/i18n.service';
import { ThemeService } from '../core/theme.service';
import { AuthService } from '../core/auth.service';
import { StIconComponent } from '../shared/ui/icon.component';
import { LiveStatusComponent } from '../shared/ui/live-status.component';
import type { SupportedLocale } from '../core/dictionaries';

/** Topbar: menu toggle, search, notifications, language, theme, user/session menu. */
@Component({
  selector: 'st-topbar',
  standalone: true,
  imports: [FormsModule, StIconComponent, LiveStatusComponent],
  template: `
    <header class="st-top">
      <button
        type="button"
        class="st-icon-btn st-top__menu"
        (click)="menu.emit()"
        [attr.aria-label]="i18n.t('shell.menu')"
      >
        <st-icon name="menu" [size]="19" />
      </button>
      <label class="st-top__search">
        <st-icon name="search" [size]="16" />
        <input
          type="search"
          class="st-top__input"
          [placeholder]="i18n.t('shell.search')"
          [attr.aria-label]="i18n.t('shell.search')"
          [(ngModel)]="search"
        />
      </label>
      <div class="st-top__spacer"></div>
      <st-live-status />
      <button
        type="button"
        class="st-icon-btn"
        [attr.aria-label]="i18n.t('shell.notifications')"
        [attr.title]="i18n.t('shell.notifications')"
      >
        <st-icon name="bell" [size]="18" />
        @if (unread > 0) {
          <span class="st-top__dot" aria-hidden="true">{{ unread > 9 ? '9+' : unread }}</span>
        }
      </button>
      <label class="st-top__select">
        <span class="st-sr-only">{{ i18n.t('shell.language') }}</span>
        <st-icon name="globe" [size]="16" />
        <select
          [ngModel]="i18n.locale()"
          (ngModelChange)="onLocale($event)"
          aria-label="{{ i18n.t('shell.language') }}"
        >
          <option value="fr">FR</option>
          <option value="en">EN</option>
          <option value="ar">AR</option>
        </select>
      </label>
      <label class="st-top__select">
        <span class="st-sr-only">{{ i18n.t('shell.theme') }}</span>
        @if (theme.resolved() === 'dark') {
          <st-icon name="moon" [size]="16" />
        } @else {
          <st-icon name="sun" [size]="16" />
        }
        <select
          [ngModel]="theme.mode()"
          (ngModelChange)="theme.setMode($event)"
          aria-label="{{ i18n.t('shell.theme') }}"
        >
          <option value="light">{{ i18n.t('shell.theme.light') }}</option>
          <option value="dark">{{ i18n.t('shell.theme.dark') }}</option>
          <option value="system">{{ i18n.t('shell.theme.system') }}</option>
        </select>
      </label>
      <div class="st-user">
        <button
          type="button"
          class="st-user__btn"
          (click)="userOpen = !userOpen"
          [attr.aria-expanded]="userOpen"
          aria-haspopup="menu"
          [attr.aria-label]="i18n.t('shell.session')"
        >
          <span class="st-user__avatar" aria-hidden="true">{{ initials() }}</span>
          <span class="st-user__meta">
            <strong>{{ auth.user()?.displayName ?? '—' }}</strong>
            <small>{{ roleLabel() }}</small>
          </span>
        </button>
        @if (userOpen) {
          <div class="st-user__menu" role="menu">
            <p class="st-user__signed">
              {{ i18n.t('shell.signedInAs') }}<br /><strong dir="auto">{{
                auth.user()?.email
              }}</strong>
            </p>
            <button type="button" role="menuitem" class="st-user__item" (click)="auth.signOut()">
              <st-icon name="logout" [size]="15" /> {{ i18n.t('shell.signOut') }}
            </button>
          </div>
        }
      </div>
    </header>
  `,
  styles: [
    `
      .st-top {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        row-gap: 0.4rem;
        flex-wrap: wrap;
        padding: 0.55rem 1rem;
        background: var(--bg-surface);
        border-block-end: 1px solid var(--border-subtle);
        position: sticky;
        inset-block-start: 0;
        z-index: 60;
      }
      .st-top__search {
        display: flex;
        align-items: center;
        gap: 0.45rem;
        background: var(--bg-page);
        border: 1px solid var(--border-subtle);
        border-radius: 0.55rem;
        padding: 0.35rem 0.6rem;
        flex: 1;
        max-inline-size: 26rem;
        color: var(--text-muted);
      }
      .st-top__input {
        border: 0;
        background: none;
        flex: 1;
        font: inherit;
        font-size: 0.85rem;
        color: var(--text-primary);
        min-inline-size: 0;
      }
      .st-top__input:focus {
        outline: none;
      }
      .st-top__search:focus-within {
        border-color: var(--action-primary);
        outline: 2px solid color-mix(in srgb, var(--action-primary) 30%, transparent);
      }
      .st-top__spacer {
        flex: 1;
      }
      .st-top__dot {
        position: absolute;
        inset-block-start: -0.3rem;
        inset-inline-end: -0.3rem;
        background: var(--action-danger);
        color: #fff;
        font-size: 0.62rem;
        font-weight: 700;
        border-radius: 999px;
        padding: 0.05rem 0.35rem;
      }
      .st-icon-btn {
        position: relative;
      }
      .st-top__select {
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
        color: var(--text-secondary);
      }
      .st-top__select select {
        background: var(--bg-page);
        color: var(--text-primary);
        border: 1px solid var(--border-subtle);
        border-radius: 0.5rem;
        padding: 0.35rem 0.4rem;
        font-size: 0.8rem;
      }
      .st-user {
        position: relative;
      }
      .st-user__btn {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        border: 1px solid var(--border-subtle);
        background: var(--bg-page);
        border-radius: 0.6rem;
        padding: 0.3rem 0.5rem;
        cursor: pointer;
        color: var(--text-primary);
      }
      .st-user__avatar {
        inline-size: 2rem;
        block-size: 2rem;
        border-radius: 50%;
        background: var(--bg-inverse);
        color: var(--text-inverse);
        display: grid;
        place-items: center;
        font-size: 0.75rem;
        font-weight: 700;
      }
      .st-user__meta {
        display: grid;
        text-align: start;
        line-height: 1.15;
      }
      .st-user__meta small {
        color: var(--text-muted);
        font-size: 0.68rem;
      }
      .st-user__menu {
        position: absolute;
        inset-inline-end: 0;
        inset-block-start: calc(100% + 0.4rem);
        background: var(--bg-elevated);
        border: 1px solid var(--border-default);
        border-radius: 0.6rem;
        padding: 0.6rem;
        min-inline-size: 14rem;
        box-shadow: var(--shadow-md);
        z-index: 80;
      }
      .st-user__signed {
        font-size: 0.78rem;
        color: var(--text-secondary);
        margin: 0 0 0.5rem;
      }
      .st-user__item {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        inline-size: 100%;
        border: 0;
        background: none;
        padding: 0.5rem;
        border-radius: 0.45rem;
        cursor: pointer;
        font-size: 0.85rem;
        color: var(--text-primary);
        min-block-size: 2.75rem;
      }
      .st-user__item:hover {
        background: var(--border-subtle);
      }
      @media (max-width: 767px) {
        .st-user__meta,
        .st-top__search {
          display: none;
        }
        .st-top__menu {
          display: inline-flex;
        }
      }
      @media (min-width: 768px) {
        .st-top__menu {
          display: none;
        }
      }
    `,
  ],
})
export class TopbarComponent {
  readonly i18n = inject(I18nService);
  readonly theme = inject(ThemeService);
  readonly auth = inject(AuthService);
  @Input() unread = 3;
  @Output() menu = new EventEmitter<void>();
  search = '';
  userOpen = false;

  onLocale(locale: SupportedLocale): void {
    this.i18n.setLocale(locale);
  }

  initials(): string {
    const name = this.auth.user()?.displayName ?? '?';
    return name
      .split(' ')
      .map((p) => p[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }

  roleLabel(): string {
    const role = this.auth.role();
    if (!role) return '';
    return this.i18n.t(`login.role.${role.toLowerCase()}` as string);
  }
}
