import { Component, inject, signal, computed, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from './sidebar.component';
import { TopbarComponent } from './topbar.component';
import { BreadcrumbsComponent } from './breadcrumbs.component';
import { ToastsComponent } from '../shared/ui/toasts.component';
import { I18nService } from '../core/i18n.service';
import { AuthService } from '../core/auth.service';
import { visibleNav } from '../core/roles';

/**
 * Formal institutional shell: collapsible sidebar (drawer on mobile),
 * topbar, breadcrumbs, page title/actions area (per-page), user menu.
 */
@Component({
  selector: 'st-shell',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, TopbarComponent, BreadcrumbsComponent, ToastsComponent],
  template: `
    <a class="st-skip" href="#st-content">{{ i18n.t('shell.skipToContent') }}</a>
    <div class="st-shell">
      <aside
        class="st-shell__side"
        [class.st-shell__side--open]="drawerOpen()"
        [attr.aria-hidden]="isMobile() && !drawerOpen()"
      >
        <st-sidebar
          [sections]="sections()"
          [collapsed]="collapsed()"
          (toggle)="collapsed.set(!collapsed())"
        />
      </aside>
      @if (drawerOpen() && isMobile()) {
        <div class="st-shell__scrim" (click)="drawerOpen.set(false)" aria-hidden="true"></div>
      }
      <div class="st-shell__main">
        <st-topbar (menu)="drawerOpen.set(!drawerOpen())" />
        <main id="st-content" class="st-shell__content" tabindex="-1">
          <div class="st-shell__inner">
            <st-breadcrumbs />
            <router-outlet />
          </div>
        </main>
      </div>
    </div>
    <st-toasts />
  `,
  styles: [
    `
      .st-shell {
        display: flex;
        min-block-size: 100dvh;
        background: var(--bg-page);
        color: var(--text-primary);
      }
      .st-shell__side {
        flex: none;
        position: sticky;
        inset-block-start: 0;
        block-size: 100dvh;
        z-index: 70;
      }
      .st-shell__main {
        flex: 1;
        min-inline-size: 0;
        display: flex;
        flex-direction: column;
      }
      .st-shell__content {
        flex: 1;
      }
      .st-shell__inner {
        inline-size: 100%;
        max-inline-size: 80rem;
        margin-inline: auto;
        padding: 1rem 1.25rem 3rem;
      }
      .st-shell__scrim {
        position: fixed;
        inset: 0;
        background: rgb(2 12 24 / 0.45);
        z-index: 65;
      }
      @media (max-width: 1023px) {
        .st-shell__side {
          position: fixed;
          inset-block: 0;
          inset-inline-start: 0;
          transform: translateX(-110%);
          transition: transform 0.2s ease;
        }
        :host-context([dir='rtl']) .st-shell__side {
          transform: translateX(110%);
        }
        .st-shell__side--open {
          transform: none !important;
        }
      }
    `,
  ],
})
export class ShellComponent {
  readonly i18n = inject(I18nService);
  readonly auth = inject(AuthService);
  private readonly platformId = inject(PLATFORM_ID);

  readonly collapsed = signal(false);
  readonly drawerOpen = signal(false);
  readonly narrow = signal(false);
  readonly sections = computed(() => visibleNav(this.auth.role()));
  readonly isMobile = computed(() => this.narrow());

  constructor() {
    if (isPlatformBrowser(this.platformId) && typeof window.matchMedia === 'function') {
      const mq = window.matchMedia('(max-width: 1023px)');
      this.narrow.set(mq.matches);
      mq.addEventListener('change', (e) => this.narrow.set(e.matches));
    }
  }
}
