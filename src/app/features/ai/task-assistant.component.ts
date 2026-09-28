import { Component, inject, signal, computed, OnInit, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { I18nService } from '../../core/i18n.service';
import { BreadcrumbService } from '../../core/breadcrumb.service';
import { AuthService } from '../../core/auth.service';
import { RealtimeService } from '../../core/realtime.service';
import { AiAssistantService, type AssistData, type AssistPriority } from './ai-assistant.service';
import { readRememberedSupervisor } from '../internships/supervisor-scope';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { LiveStatusComponent } from '../../shared/ui/live-status.component';
import { BadgeComponent, type BadgeTone } from '../../shared/ui/badge.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { EmptyStateComponent, ErrorStateComponent } from '../../shared/ui/states.component';
import { AlertComponent } from '../../shared/ui/alert.component';

/**
 * Administrative Task Assistant: pending work identified by deterministic
 * backend rules (never by a language model). Priorities are transparent;
 * completing a task always means performing the underlying workflow —
 * checking a box here never bypasses a business operation.
 */
@Component({
  selector: 'st-task-assistant',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    PageHeaderComponent,
    LiveStatusComponent,
    BadgeComponent,
    SkeletonComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    AlertComponent,
  ],
  template: `
    <st-page-header [title]="i18n.t('tasks.title')" [subtitle]="i18n.t('tasks.subtitle')">
      <st-live-status />
    </st-page-header>

    <section class="st-filters" [attr.aria-label]="i18n.t('table.filters')">
      <label class="st-field">
        <span class="st-field__label">{{ i18n.t('tasks.priority') }}</span>
        <select class="st-input" [(ngModel)]="priority" (change)="page.set(0)">
          <option value="">{{ i18n.t('table.all') }}</option>
          <option value="high">{{ i18n.t('tasks.high') }}</option>
          <option value="medium">{{ i18n.t('tasks.medium') }}</option>
          <option value="low">{{ i18n.t('tasks.low') }}</option>
        </select>
      </label>
      <label class="st-field st-field--grow">
        <span class="st-field__label">{{ i18n.t('table.search') }}</span>
        <input
          type="search"
          class="st-input"
          [(ngModel)]="search"
          (keyup.enter)="page.set(0)"
          dir="auto"
        />
      </label>
    </section>

    @if (error()) {
      <st-error-state
        [title]="i18n.t('common.error.title')"
        [body]="i18n.t('common.error.body')"
        [retryLabel]="i18n.t('common.retry')"
        (retry)="load()"
      />
    } @else if (loading()) {
      <st-skeleton [rows]="8" />
    } @else {
      <section class="st-kpis" aria-label="kpis">
        <div class="st-kpi">
          <span class="st-kpi__n">{{ filtered().length }}</span>
          <span class="st-kpi__l">{{ i18n.t('tasks.pending') }}</span>
        </div>
        <div class="st-kpi">
          <span class="st-kpi__n">{{ highCount() }}</span>
          <span class="st-kpi__l">{{ i18n.t('tasks.high') }}</span>
        </div>
        <div class="st-kpi">
          <span class="st-kpi__n">{{ overdueCount() }}</span>
          <span class="st-kpi__l">{{ i18n.t('tasks.overdue') }}</span>
        </div>
      </section>

      <st-alert tone="info">{{ i18n.t('assistant.ruleBasedNote') }}</st-alert>

      @if (filtered().length === 0) {
        <st-empty-state [title]="i18n.t('common.empty.title')" [body]="i18n.t('tasks.empty')" />
      } @else {
        <ul class="st-rows">
          @for (t of filtered(); track t.id) {
            <li class="st-row">
              <div class="st-row__meta">
                <strong dir="auto">{{ i18n.t(t.titleKey, t.titleParams) }}</strong>
                <span class="st-row__sub" dir="auto">
                  {{ i18n.t('tasks.kind.' + t.kind) }}
                  @if (t.dueDate) {
                    <span dir="ltr"> · {{ t.dueDate }}</span>
                  }
                </span>
                <span class="st-row__sub" dir="auto">{{
                  i18n.t('tasks.priorityWhy.' + t.priority)
                }}</span>
              </div>
              <div class="st-row__actions">
                <st-badge
                  [label]="i18n.t('tasks.' + t.priority)"
                  [tone]="priorityTone(t.priority)"
                />
                <a [routerLink]="t.link" class="st-btn st-btn--primary">{{
                  i18n.t('tasks.open')
                }}</a>
              </div>
            </li>
          }
        </ul>
      }
    }
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
        margin-block-end: 0.8rem;
      }
      .st-field--grow {
        flex: 1;
        min-inline-size: 12rem;
      }
      .st-kpis {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(8.5rem, 1fr));
        gap: 0.6rem;
        margin-block-end: 0.8rem;
      }
      .st-kpi {
        background: var(--bg-surface);
        border: 1px solid var(--border-subtle);
        border-radius: 0.7rem;
        padding: 0.7rem 0.8rem;
        display: grid;
        gap: 0.15rem;
      }
      .st-kpi__n {
        font-size: 1.4rem;
        font-weight: 700;
      }
      .st-kpi__l {
        font-size: 0.75rem;
        color: var(--text-secondary);
      }
      .st-rows {
        list-style: none;
        margin: 0.8rem 0 0;
        padding: 0;
        display: grid;
        gap: 0.55rem;
      }
      .st-row {
        display: flex;
        gap: 0.7rem;
        justify-content: space-between;
        align-items: flex-start;
        flex-wrap: wrap;
        border: 1px solid var(--border-subtle);
        border-radius: 0.6rem;
        padding: 0.65rem 0.75rem;
        background: var(--bg-surface);
      }
      .st-row__meta {
        display: grid;
        gap: 0.2rem;
        flex: 1;
        min-inline-size: 14rem;
        font-size: 0.85rem;
      }
      .st-row__sub {
        font-size: 0.75rem;
        color: var(--text-muted);
        overflow-wrap: anywhere;
      }
      .st-row__actions {
        display: flex;
        gap: 0.4rem;
        flex-wrap: wrap;
        align-items: center;
      }
    `,
  ],
})
export class TaskAssistantComponent implements OnInit {
  readonly i18n = inject(I18nService);
  private readonly crumbs = inject(BreadcrumbService);
  private readonly assistant = inject(AiAssistantService);
  private readonly auth = inject(AuthService);
  private readonly realtime = inject(RealtimeService);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly error = signal(false);
  readonly priority = signal('');
  readonly search = signal('');
  readonly page = signal(0);
  private readonly data = signal<AssistData | null>(null);

  readonly tasks = computed(() => {
    const data = this.data();
    return data ? this.assistant.tasks(data) : [];
  });
  readonly filtered = computed(() => {
    const p = this.priority();
    const q = this.search().trim().toLowerCase();
    return this.tasks().filter(
      (t) =>
        (!p || t.priority === p) &&
        (!q || this.i18n.t(t.titleKey, t.titleParams).toLowerCase().includes(q)),
    );
  });
  readonly highCount = computed(() => this.tasks().filter((t) => t.priority === 'high').length);
  readonly overdueCount = computed(
    () => this.tasks().filter((t) => t.priority === 'high' && t.dueDate).length,
  );

  ngOnInit(): void {
    this.crumbs.set([{ labelKey: 'nav.tasks', labelFallback: 'Tasks' }]);
    this.load();
    this.realtime.backofficeEvents$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.load());
  }

  priorityTone(p: AssistPriority): BadgeTone {
    return p === 'high' ? 'error' : p === 'medium' ? 'warning' : 'neutral';
  }

  load(): void {
    this.loading.set(true);
    this.error.set(false);
    const scope = this.auth.role() === 'SUPERVISOR' ? readRememberedSupervisor() : '';
    this.assistant.loadScoped(scope).subscribe({
      next: (data) => {
        this.data.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }
}
