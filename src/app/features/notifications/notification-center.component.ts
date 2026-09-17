import { Component, inject, signal, DestroyRef, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { I18nService } from '../../core/i18n.service';
import { BreadcrumbService } from '../../core/breadcrumb.service';
import { AuthService } from '../../core/auth.service';
import { ApiClient } from '../../core/api-client.service';
import { RealtimeService } from '../../core/realtime.service';
import { ToastService } from '../../shared/ui/toast.service';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { BadgeComponent } from '../../shared/ui/badge.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { EmptyStateComponent, ErrorStateComponent } from '../../shared/ui/states.component';
import { LiveStatusComponent } from '../../shared/ui/live-status.component';
import { formatDateTime } from '../../core/format';
import type { NotificationItem } from '../../core/api-models';

/**
 * Staff notification center (E3): own deliveries only (backend-scoped),
 * live refresh on push, mark read / read-all. No polling, no placeholders.
 */
@Component({
  selector: 'st-notification-center',
  standalone: true,
  imports: [
    PageHeaderComponent,
    BadgeComponent,
    SkeletonComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    LiveStatusComponent,
  ],
  styles: [
    `
      .st-nc-bar {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin-bottom: 1rem;
      }
      .st-nc-bar .spacer {
        flex: 1;
      }
      .st-nc-item {
        border: 1px solid var(--st-border, #e5e7eb);
        border-radius: 0.75rem;
        padding: 0.9rem 1rem;
        margin-bottom: 0.6rem;
        background: var(--st-surface, #fff);
      }
      .st-nc-item--unread {
        border-inline-start: 3px solid var(--st-accent, #0b61a0);
      }
      .st-nc-head {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex-wrap: wrap;
        font-weight: 600;
      }
      .st-nc-msg {
        margin: 0.4rem 0;
        color: inherit;
        opacity: 0.85;
      }
      .st-nc-meta {
        font-size: 0.8rem;
        opacity: 0.65;
      }
      .st-nc-foot {
        margin-top: 0.4rem;
      }
    `,
  ],
  template: `
    <st-page-header
      [title]="i18n.t('notifications.title')"
      [subtitle]="i18n.t('notifications.subtitle')"
    />
    <div class="st-nc-bar">
      <st-live-status />
      <span class="spacer"></span>
      <button
        type="button"
        class="st-btn st-btn--secondary"
        [disabled]="busy()"
        (click)="readAll()"
      >
        {{ i18n.t('notifications.readAll') }}
      </button>
    </div>
    @if (loading()) {
      <st-skeleton [rows]="6" />
    } @else if (error()) {
      <st-error-state
        [title]="i18n.t('common.error.title')"
        [body]="i18n.t('common.error.body')"
        [retryLabel]="i18n.t('common.retry')"
        (retry)="load()"
      />
    } @else if (items().length === 0) {
      <st-empty-state
        [title]="i18n.t('notifications.emptyTitle')"
        [body]="i18n.t('notifications.emptyBody')"
      />
    } @else {
      @for (n of items(); track n.id) {
        <article class="st-nc-item" [class.st-nc-item--unread]="!n.read">
          <div class="st-nc-head">
            <span dir="auto">{{ n.title }}</span>
            <st-badge [label]="n.priority" [tone]="n.priority === 'URGENT' ? 'error' : 'neutral'" />
          </div>
          <p class="st-nc-msg" dir="auto">{{ n.message }}</p>
          <p class="st-nc-meta">{{ fmtDateTime(n.createdAt) }}</p>
          @if (!n.read) {
            <div class="st-nc-foot">
              <button
                type="button"
                class="st-btn st-btn--text"
                [disabled]="busy()"
                (click)="readOne(n.id)"
              >
                {{ i18n.t('notifications.markRead') }}
              </button>
            </div>
          }
        </article>
      }
      @if (hasMore()) {
        <button type="button" class="st-btn st-btn--secondary" [disabled]="busy()" (click)="more()">
          {{ i18n.t('common.more') }}
        </button>
      }
    }
  `,
})
export class NotificationCenterComponent implements OnInit {
  readonly i18n = inject(I18nService);
  readonly auth = inject(AuthService);
  private readonly api = inject(ApiClient);
  private readonly realtime = inject(RealtimeService);
  private readonly toast = inject(ToastService);
  private readonly crumbs = inject(BreadcrumbService);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal(false);
  readonly items = signal<readonly NotificationItem[]>([]);
  readonly hasMore = signal(false);
  private page = 0;
  private readonly size = 20;

  ngOnInit(): void {
    this.crumbs.set([{ labelKey: 'nav.notifications', labelFallback: 'Notifications' }]);
    this.load();
    // Live: refresh the list when a push notification arrives (no refresh needed).
    this.realtime.notifications$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.load());
  }

  load(): void {
    this.loading.set(true);
    this.error.set(false);
    this.api.getNotifications(false, 0, this.size).subscribe({
      next: (page) => {
        this.items.set(page.content);
        this.hasMore.set((page.number + 1) * page.size < page.totalElements);
        this.page = 0;
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  more(): void {
    this.busy.set(true);
    this.api.getNotifications(false, this.page + 1, this.size).subscribe({
      next: (page) => {
        this.items.update((rows) => [...rows, ...page.content]);
        this.hasMore.set((page.number + 1) * page.size < page.totalElements);
        this.page += 1;
        this.busy.set(false);
      },
      error: () => {
        this.busy.set(false);
        this.toast.show('error', this.i18n.t('common.error.body'));
      },
    });
  }

  readOne(id: string): void {
    this.busy.set(true);
    this.api.markNotificationRead(id).subscribe({
      next: () => {
        this.items.update((rows) => rows.map((n) => (n.id === id ? { ...n, read: true } : n)));
        this.busy.set(false);
      },
      error: () => {
        this.busy.set(false);
        this.toast.show('error', this.i18n.t('common.error.body'));
      },
    });
  }

  readAll(): void {
    this.busy.set(true);
    this.api.markAllNotificationsRead().subscribe({
      next: () => {
        this.items.update((rows) => rows.map((n) => ({ ...n, read: true })));
        this.busy.set(false);
        this.toast.show('success', this.i18n.t('notifications.allRead'));
      },
      error: () => {
        this.busy.set(false);
        this.toast.show('error', this.i18n.t('common.error.body'));
      },
    });
  }

  fmtDateTime(iso: string): string {
    return formatDateTime(iso, this.i18n.locale());
  }
}
