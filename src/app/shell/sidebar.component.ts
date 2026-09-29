import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { I18nService } from '../core/i18n.service';
import { StIconComponent } from '../shared/ui/icon.component';
import type { NavSection } from '../core/roles';

/**
 * Primary navigation rail — the identity surface of the Back Office.
 * Deep institutional navy (STEG brand) with an azure active indicator,
 * generous nav rows, refined section headings. Mirrors the premium
 * enterprise dashboard pattern (Meta-style) while remaining STEG.
 * Logical properties keep placement correct in RTL.
 */
@Component({
  selector: 'st-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, StIconComponent],
  template: `
    <nav class="st-side" [class.st-side--collapsed]="collapsed" aria-label="Primary">
      <div class="st-side__brand">
        @if (collapsed) {
          <span class="st-side__tile">
            <img
              class="st-side__mark"
              src="logo/android-chrome-192x192.png"
              srcset="logo/android-chrome-192x192.png 192w, logo/android-chrome-512x512.png 512w"
              sizes="42px"
              width="192"
              height="192"
              alt="STEG"
            />
          </span>
        } @else {
          <div class="st-side__card">
            <img
              class="st-side__logo"
              src="logo/logo-steg-1200x327.png"
              width="1200"
              height="327"
              alt="STEG"
            />
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
        background: linear-gradient(180deg, var(--brand-navy) 0%, var(--brand-navy-deep) 100%);
        color: var(--text-inverse);
        inline-size: 16.5rem;
        max-inline-size: calc(100vw - 3rem);
        transition: inline-size 0.18s ease;
      }
      .st-side--collapsed {
        inline-size: 4.5rem;
      }
      .st-side--collapsed .st-side__section {
        display: none;
      }
      .st-side__brand {
        display: flex;
        align-items: center;
        justify-content: center;
        min-block-size: 6rem;
        padding: 0.5rem 0.95rem;
        overflow: hidden;
        border-block-end: 1px solid rgb(255 255 255 / 0.1);
      }
      .st-side--collapsed .st-side__brand {
        padding-inline: 0.5rem;
      }
      .st-side__tile,
      .st-side__card {
        background: #fff;
        box-shadow: 0 2px 10px rgb(2 12 24 / 0.32);
        animation: st-brand-in 0.18s ease both;
      }
      .st-side__tile {
        flex: none;
        display: grid;
        place-items: center;
        inline-size: 1.75rem;
        block-size: 2.6rem;
        padding: 0.18rem 0.12rem;
        border-radius: 0.45rem;
      }
      .st-side__mark {
        display: block;
        inline-size: 100%;
        block-size: 100%;
        object-fit: cover;
      }
      .st-side__card {
        inline-size: fit-content;
        max-inline-size: 100%;
        display: grid;
        place-items: center;
        padding: 0.55rem 0.8rem;
        border-radius: 0.6rem;
      }
      .st-side__logo {
        display: block;
        inline-size: min(12.25rem, 100%);
        block-size: auto;
        aspect-ratio: 1200 / 327;
        object-fit: contain;
      }
      @keyframes st-brand-in {
        from {
          opacity: 0;
          transform: scale(0.97);
        }
        to {
          opacity: 1;
          transform: none;
        }
      }
      .st-side__nav {
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
        padding: 0.75rem 0.6rem 0.5rem;
        display: grid;
        gap: 0.2rem;
        align-content: start;
      }
      .st-side__section {
        margin: 0.85rem 0.55rem 0.3rem;
        font-size: 0.64rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.09em;
        color: rgb(255 255 255 / 0.45);
      }
      .st-side__list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 0.1rem;
      }
      .st-side__link {
        position: relative;
        display: flex;
        align-items: center;
        gap: 0.7rem;
        padding: 0.55rem 0.7rem;
        border-radius: var(--radius-sm);
        color: rgb(255 255 255 / 0.82);
        text-decoration: none;
        font-size: 0.85rem;
        min-block-size: 2.4rem;
        transition:
          background-color 0.15s ease,
          color 0.15s ease;
      }
      .st-side__link:hover {
        background: rgb(255 255 255 / 0.08);
        color: #fff;
      }
      .st-side__link--active {
        background: rgb(255 255 255 / 0.13);
        color: #fff;
        font-weight: 600;
      }
      .st-side__link--active::before {
        content: '';
        position: absolute;
        inset-inline-start: -0.6rem;
        inset-block: 0.35rem;
        inline-size: 3px;
        border-radius: 999px;
        background: #fff;
      }
      .st-side__link:focus-visible {
        outline: 2px solid #fff;
        outline-offset: -2px;
      }
      .st-side--collapsed .st-side__link {
        justify-content: center;
        padding-inline: 0;
      }
      .st-side__collapse {
        margin: 0.6rem 0.75rem 0.75rem;
        align-self: flex-end;
        background: rgb(255 255 255 / 0.06);
        border-color: rgb(255 255 255 / 0.2);
        color: rgb(255 255 255 / 0.85);
      }
      .st-side__collapse:hover {
        background: rgb(255 255 255 / 0.14);
        border-color: rgb(255 255 255 / 0.35);
        color: #fff;
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
