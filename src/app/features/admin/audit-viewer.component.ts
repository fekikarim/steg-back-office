import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { I18nService } from '../../core/i18n.service';
import { BreadcrumbService } from '../../core/breadcrumb.service';
import { ToastService } from '../../shared/ui/toast.service';
import { AdminService, isForbidden, truncateSnapshot } from './admin.service';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { BadgeComponent } from '../../shared/ui/badge.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { EmptyStateComponent, ErrorStateComponent } from '../../shared/ui/states.component';
import { AlertComponent } from '../../shared/ui/alert.component';
import { DataTableComponent } from '../../shared/ui/data-table.component';
import { PaginationComponent } from '../../shared/ui/pagination.component';
import { DrawerComponent } from '../../shared/ui/drawer.component';
import { StIconComponent } from '../../shared/ui/icon.component';
import type { AuditLogEntry } from '../../core/api-models';

/**
 * Audit viewer (ADMIN only, backend-enforced). Read-only by construction:
 * this screen issues GET requests exclusively — no edit/delete affordance
 * exists. Sensitive payloads (old/new values, IPs) render truncated, and
 * backend redaction is respected verbatim (no client-side reassembly).
 */
@Component({
  selector: 'st-audit-viewer',
  standalone: true,
  imports: [
    FormsModule,
    PageHeaderComponent,
    BadgeComponent,
    SkeletonComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    AlertComponent,
    DataTableComponent,
    PaginationComponent,
    DrawerComponent,
    StIconComponent,
  ],
  template: `
    <st-page-header [title]="i18n.t('audit.title')" [subtitle]="i18n.t('audit.subtitle')">
      <button type="button" class="st-btn st-btn--secondary" (click)="load()">
        <st-icon name="refresh" [size]="15" /> {{ i18n.t('table.refresh') }}
      </button>
    </st-page-header>

    <st-alert tone="info">{{ i18n.t('audit.readOnlyNote') }}</st-alert>

    <section class="st-filters" [attr.aria-label]="i18n.t('table.filters')">
      <label class="st-field">
        <span class="st-field__label">{{ i18n.t('audit.action') }}</span>
        <input
          type="search"
          class="st-input"
          [(ngModel)]="action"
          (keyup.enter)="onServerFilter()"
          placeholder="APPLICATION_ACCEPTED"
          dir="ltr"
        />
      </label>
      <label class="st-field st-field--grow">
        <span class="st-field__label">{{ i18n.t('audit.entityId') }}</span>
        <input
          type="search"
          class="st-input"
          [(ngModel)]="entityId"
          (keyup.enter)="onServerFilter()"
          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          dir="ltr"
        />
      </label>
      <label class="st-field st-field--grow">
        <span class="st-field__label">{{ i18n.t('audit.actorId') }}</span>
        <input
          type="search"
          class="st-input"
          [(ngModel)]="actorId"
          (keyup.enter)="onServerFilter()"
          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          dir="ltr"
        />
      </label>
      <label class="st-field">
        <span class="st-field__label">{{ i18n.t('audit.from') }}</span>
        <input type="date" class="st-input" [(ngModel)]="from" />
      </label>
      <label class="st-field">
        <span class="st-field__label">{{ i18n.t('audit.to') }}</span>
        <input type="date" class="st-input" [(ngModel)]="to" />
      </label>
      <button type="button" class="st-btn st-btn--primary" (click)="onServerFilter()">
        {{ i18n.t('common.apply') }}
      </button>
      <button type="button" class="st-btn st-btn--secondary" (click)="clearFilters()">
        {{ i18n.t('common.reset') }}
      </button>
    </section>
    <p class="st-hint">{{ i18n.t('audit.dateNote') }}</p>

    @if (forbidden()) {
      <st-alert tone="error" [title]="i18n.t('common.forbidden.title')">
        {{ i18n.t('common.forbidden.body') }}
      </st-alert>
    } @else if (error()) {
      <st-error-state
        [title]="i18n.t('common.error.title')"
        [body]="serverMessage() || i18n.t('common.error.body')"
        [retryLabel]="i18n.t('common.retry')"
        (retry)="load()"
      />
    } @else if (loading()) {
      <st-skeleton [rows]="8" />
    } @else if (filtered().length === 0) {
      <st-empty-state [title]="i18n.t('common.empty.title')" [body]="i18n.t('common.empty.body')" />
    } @else {
      <st-data-table [columns]="columns" [hasActions]="true">
        @for (row of filtered(); track row.id) {
          <tr>
            <td dir="ltr" data-priority="low">
              {{ row.createdAt.slice(0, 16).replace('T', ' ') }}
            </td>
            <td dir="ltr">
              <strong>{{ row.action }}</strong>
            </td>
            <td dir="auto" data-priority="medium">{{ row.entityType }}</td>
            <td dir="auto" data-priority="medium">{{ row.actorEmail || '—' }}</td>
            <td>
              <button type="button" class="st-btn st-btn--text" (click)="openDetail(row)">
                {{ i18n.t('common.view') }}
              </button>
            </td>
          </tr>
        }
      </st-data-table>
      <st-pagination
        [page]="page()"
        [size]="size()"
        [totalPages]="totalPages()"
        (prev)="setPage(page() - 1)"
        (next)="setPage(page() + 1)"
        (sizeChange)="size.set($event); setPage(0); reload()"
      />
    }

    <st-drawer
      [open]="selected() !== null"
      [title]="i18n.t('audit.detailTitle')"
      (close)="selected.set(null)"
    >
      @if (selected(); as entry) {
        <dl class="st-defs">
          <div>
            <dt>{{ i18n.t('audit.action') }}</dt>
            <dd dir="ltr">
              <strong>{{ entry.action }}</strong>
            </dd>
          </div>
          <div>
            <dt>{{ i18n.t('audit.at') }}</dt>
            <dd dir="ltr">{{ entry.createdAt }}</dd>
          </div>
          <div>
            <dt>{{ i18n.t('audit.entity') }}</dt>
            <dd dir="auto">{{ entry.entityType }}</dd>
          </div>
          <div>
            <dt>{{ i18n.t('audit.entityId') }}</dt>
            <dd dir="ltr">{{ entry.entityId }}</dd>
          </div>
          <div>
            <dt>{{ i18n.t('audit.actor') }}</dt>
            <dd dir="auto">{{ entry.actorEmail || entry.actorId }}</dd>
          </div>
          <div>
            <dt>{{ i18n.t('audit.ip') }}</dt>
            <dd dir="ltr">{{ entry.ipAddress || '—' }}</dd>
          </div>
        </dl>
        @if (entry.oldValues) {
          <h3 class="st-sub">{{ i18n.t('audit.oldValues') }}</h3>
          <pre class="st-payload" dir="ltr">{{ preview(entry.oldValues) }}</pre>
        }
        @if (entry.newValues) {
          <h3 class="st-sub">{{ i18n.t('audit.newValues') }}</h3>
          <pre class="st-payload" dir="ltr">{{ preview(entry.newValues) }}</pre>
        }
        <p class="st-hint">{{ i18n.t('audit.redactionNote') }}</p>
      }
    </st-drawer>
  `,
  styles: [
    `
      .st-filters {
        display: flex;
        gap: 0.6rem;
        flex-wrap: wrap;
        align-items: flex-end;
        background: var(--bg-surface);
        border: 1px solid var(--border-subtle);
        border-radius: 0.7rem;
        padding: 0.8rem;
        margin-block: 0.8rem 0.4rem;
      }
      .st-field--grow {
        flex: 1;
        min-inline-size: 12rem;
      }
      .st-hint {
        font-size: 0.78rem;
        color: var(--text-secondary);
        margin: 0 0 0.8rem;
      }
      .st-defs {
        display: grid;
        gap: 0.5rem;
        margin: 0;
      }
      .st-defs div {
        display: grid;
        grid-template-columns: 8rem 1fr;
        gap: 0.5rem;
        font-size: 0.84rem;
      }
      .st-defs dt {
        color: var(--text-muted);
      }
      .st-defs dd {
        margin: 0;
        overflow-wrap: anywhere;
      }
      .st-sub {
        font-size: 0.85rem;
        margin: 0.9rem 0 0.4rem;
      }
      .st-payload {
        font-size: 0.74rem;
        background: var(--bg-page);
        border: 1px solid var(--border-subtle);
        border-radius: 0.5rem;
        padding: 0.6rem 0.7rem;
        overflow: auto;
        max-block-size: 16rem;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
      }
    `,
  ],
})
export class AuditViewerComponent implements OnInit {
  readonly i18n = inject(I18nService);
  private readonly crumbs = inject(BreadcrumbService);
  private readonly service = inject(AdminService);
  private readonly toast = inject(ToastService);

  readonly columns = [
    { key: 'createdAt', label: 'At', priority: 'low' as const },
    { key: 'action', label: 'Action', priority: 'high' as const },
    { key: 'entityType', label: 'Entity', priority: 'medium' as const },
    { key: 'actor', label: 'Actor', priority: 'medium' as const },
  ];

  readonly loading = signal(true);
  readonly error = signal(false);
  readonly forbidden = signal(false);
  readonly serverMessage = signal('');
  private readonly rows = signal<readonly AuditLogEntry[]>([]);
  readonly selected = signal<AuditLogEntry | null>(null);

  readonly action = signal('');
  readonly entityId = signal('');
  readonly actorId = signal('');
  readonly from = signal('');
  readonly to = signal('');
  readonly page = signal(0);
  readonly size = signal(20);
  readonly totalPages = signal(1);

  /** Date range refines the loaded page (backend exposes no date filter). */
  readonly filtered = computed(() => {
    const from = this.from();
    const to = this.to();
    if (!from && !to) return this.rows();
    return this.rows().filter((r) => {
      const day = r.createdAt.slice(0, 10);
      if (from && day < from) return false;
      if (to && day > to) return false;
      return true;
    });
  });

  ngOnInit(): void {
    this.crumbs.set([{ labelKey: 'nav.audit', labelFallback: 'Audit' }]);
    this.load();
  }

  onServerFilter(): void {
    this.page.set(0);
    this.load();
  }

  clearFilters(): void {
    this.action.set('');
    this.entityId.set('');
    this.actorId.set('');
    this.from.set('');
    this.to.set('');
    this.page.set(0);
    this.load();
  }

  setPage(page: number): void {
    this.page.set(Math.max(0, page));
    this.load();
  }

  reload(): void {
    this.load();
  }

  openDetail(row: AuditLogEntry): void {
    this.selected.set(row);
    // Refresh the single entry for completeness; the row already carries it.
    this.service.getAuditEntry(row.id).subscribe({
      next: (entry) => this.selected.set(entry),
      error: (e: unknown) => {
        if (isForbidden(e)) this.toast.show('error', this.i18n.t('common.forbidden.body'));
      },
    });
  }

  preview(value: string | null): string {
    return truncateSnapshot(value);
  }

  load(): void {
    this.loading.set(true);
    this.error.set(false);
    this.forbidden.set(false);
    this.serverMessage.set('');
    this.service
      .searchAudit({
        action: this.action().trim() || undefined,
        entityId: this.entityId().trim() || undefined,
        actorId: this.actorId().trim() || undefined,
        page: this.page(),
        size: this.size(),
      })
      .subscribe({
        next: (page) => {
          this.rows.set(page.content);
          this.page.set(page.number);
          this.totalPages.set(Math.max(1, page.totalPages));
          this.loading.set(false);
        },
        error: (e: unknown) => {
          this.loading.set(false);
          if (isForbidden(e)) {
            this.forbidden.set(true);
          } else {
            this.error.set(true);
            this.serverMessage.set(extractMessage(e));
          }
        },
      });
  }
}

function extractMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const envelope = (error as { error?: { message?: string } }).error;
    if (envelope?.message) return envelope.message;
  }
  return '';
}
