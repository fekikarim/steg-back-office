import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { I18nService } from '../core/i18n.service';
import { StIconComponent } from '../shared/ui/icon.component';
import type { NavSection } from '../core/roles';

/** Collapsible sidebar; logical properties keep placement correct in RTL. */
@Component({
  selector: 'st-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, StIconComponent],
  template: `
    <nav class="st-side" [class.st-side--collapsed]="collapsed" aria-label="Primary">
      <div class="st-side__brand">
        <img src="logo/logo-steg-1200x327.png" alt="STEG" class="st-side__logo" />
        @if (!collapsed) {
          <div class="st-side__brand-text">
            <strong class="st-side__name">{{ i18n.t('app.name') }}</strong>
            <span class="st-side__tag">{{ i18n.t('app.tagline') }}</span>
          </div>
        }
      </div>
      <div class="st-side__nav">
        @for (section of sections; track section.titleKey) {
          <p class="st-side__section" aria-hidden="false">{{ i18n.t(section.titleKey) }}</p>
          <ul class="st-side__list">
            @for (item of section.items; track item.path) {
              <li>
                <a
                  [routerLink]="item.path"
                  routerLinkActive="st-side__link--active"
                  class="st-side__link"
                  [attr.title]="collapsed ? i18n.t(item.labelKey) : null"
                >
                  <st-icon [name]="item.icon" [size]="18" />
                  @if (!collapsed) {
                    <span>{{ i18n.t(item.labelKey) }}</span>
                  }
                </a>
              </li>
            }
          </ul>
        }
      </div>
      <button
        type="button"
        class="st-side__collapse st-icon-btn"
        (click)="toggle.emit()"
        [attr.aria-label]="collapsed ? i18n.t('shell.expand') : i18n.t('shell.collapse')"
      >
        <st-icon name="collapse" [size]="17" [mirror]="true" />
      </button>
    </nav>
  `,
  styles: [
    `
      .st-side {
        display: flex;
        flex-direction: column;
        block-size: 100%;
        background: var(--bg-inverse);
        color: var(--text-inverse);
        inline-size: 16rem;
        transition: inline-size 0.18s ease;
        border-inline-end: 1px solid var(--border-strong);
      }
      .st-side--collapsed {
        inline-size: 4.25rem;
      }
      .st-side--collapsed .st-side__section,
      .st-side--collapsed .st-side__brand-text {
        display: none;
      }
      .st-side__brand {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        padding: 0.9rem;
        border-block-end: 1px solid rgb(255 255 255 / 0.12);
      }
      .st-side__logo {
        inline-size: 2.1rem;
        block-size: 2.1rem;
        object-fit: contain;
        background: #fff;
        border-radius: 0.45rem;
        padding: 0.15rem;
        flex: none;
      }
      .st-side__name {
        display: block;
        font-size: 0.82rem;
      }
      .st-side__tag {
        display: block;
        font-size: 0.68rem;
        opacity: 0.75;
      }
      .st-side__nav {
        flex: 1;
        overflow-y: auto;
        padding: 0.6rem;
        display: grid;
        gap: 0.35rem;
        align-content: start;
      }
      .st-side__section {
        margin: 0.5rem 0.3rem 0.15rem;
        font-size: 0.66rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        opacity: 0.65;
      }
      .st-side__list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 0.15rem;
      }
      .st-side__link {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        padding: 0.55rem 0.65rem;
        border-radius: 0.5rem;
        color: inherit;
        text-decoration: none;
        font-size: 0.85rem;
        min-block-size: 2.75rem;
      }
      .st-side__link:hover {
        background: rgb(255 255 255 / 0.08);
      }
      .st-side__link--active {
        background: rgb(255 255 255 / 0.14);
        font-weight: 600;
      }
      .st-side__link:focus-visible {
        outline: 2px solid #fff;
        outline-offset: 2px;
      }
      .st-side--collapsed .st-side__link {
        justify-content: center;
      }
      .st-side__collapse {
        margin: 0.6rem;
        align-self: flex-end;
        color: inherit;
        border-color: rgb(255 255 255 / 0.25);
      }
    `,
  ],
})
export class SidebarComponent {
  readonly i18n = inject(I18nService);
  @Input() sections: readonly NavSection[] = [];
  @Input() collapsed = false;
  @Output() toggle = new EventEmitter<void>();
}
