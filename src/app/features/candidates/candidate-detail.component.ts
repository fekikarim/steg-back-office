import { Component, inject, signal, OnInit, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin, of, catchError } from 'rxjs';
import { I18nService } from '../../core/i18n.service';
import { BreadcrumbService } from '../../core/breadcrumb.service';
import { RealtimeService } from '../../core/realtime.service';
import { ApiClient } from '../../core/api-client.service';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { LiveStatusComponent } from '../../shared/ui/live-status.component';
import { BadgeComponent } from '../../shared/ui/badge.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { ErrorStateComponent } from '../../shared/ui/states.component';
import { AlertComponent } from '../../shared/ui/alert.component';
import type { ApplicationDetail, CandidateDetail } from '../../core/api-models';

/**
 * Candidate detail: identity, academic data, application history, documents
 * via linked dossiers. nationalId is sensitive — masked with reveal toggle,
 * never placed in URLs or logs.
 */
@Component({
  selector: 'st-candidate-detail',
  standalone: true,
  imports: [
    RouterLink,
    PageHeaderComponent,
    LiveStatusComponent,
    BadgeComponent,
    SkeletonComponent,
    ErrorStateComponent,
    AlertComponent,
  ],
  template: `
    @if (loading()) {
      <st-skeleton [rows]="10" />
    } @else if (error() || !candidate()) {
      <st-error-state
        [title]="i18n.t('common.error.title')"
        [body]="i18n.t('common.error.body')"
        [retryLabel]="i18n.t('common.retry')"
        (retry)="load()"
      />
      <p>
        <a routerLink="/candidates" class="st-btn st-btn--secondary">{{ i18n.t('common.back') }}</a>
      </p>
    } @else if (candidate(); as c) {
      <st-page-header [title]="c.firstName + ' ' + c.lastName" [subtitle]="c.universityName">
        <st-live-status />
        <a routerLink="/candidates" class="st-btn st-btn--secondary">{{ i18n.t('common.back') }}</a>
      </st-page-header>

      <div class="st-grid">
        <section class="st-card" [attr.aria-label]="i18n.t('candidateDetail.identity')">
          <h2 class="st-card__title">{{ i18n.t('candidateDetail.identity') }}</h2>
          <dl class="st-defs">
            <div>
              <dt>{{ i18n.t('dossier.email') }}</dt>
              <dd dir="ltr">{{ c.email }}</dd>
            </div>
            <div>
              <dt>{{ i18n.t('dossier.phone') }}</dt>
              <dd dir="ltr">{{ c.phone || '—' }}</dd>
            </div>
            <div>
              <dt>{{ i18n.t('dossier.birthDate') }}</dt>
              <dd dir="ltr">{{ c.birthDate || '—' }}</dd>
            </div>
            @if (c.address) {
              <div>
                <dt>{{ i18n.t('dossier.address') }}</dt>
                <dd dir="auto">{{ c.address }}</dd>
              </div>
            }
          </dl>
          <div class="st-cin">
            <st-badge [label]="i18n.t('common.sensitive')" tone="restricted" icon="shield" />
            <span>{{ i18n.t('dossier.nationalId') }}</span>
            @if (cinRevealed()) {
              <strong dir="ltr">{{ c.nationalId || '—' }}</strong>
              <button type="button" class="st-btn st-btn--text" (click)="cinRevealed.set(false)">
                {{ i18n.t('dossier.hide') }}
              </button>
            } @else {
              <strong aria-label="masked">••••••••</strong>
              <button type="button" class="st-btn st-btn--text" (click)="cinRevealed.set(true)">
                {{ i18n.t('dossier.reveal') }}
              </button>
            }
          </div>
          <p class="st-hint">{{ i18n.t('dossier.cinWarning') }}</p>
        </section>

        <section class="st-card" [attr.aria-label]="i18n.t('candidateDetail.academic')">
          <h2 class="st-card__title">{{ i18n.t('candidateDetail.academic') }}</h2>
          <dl class="st-defs">
            <div>
              <dt>{{ i18n.t('dossier.university') }}</dt>
              <dd dir="auto">{{ c.universityName }}</dd>
            </div>
            <div>
              <dt>{{ i18n.t('dossier.speciality') }}</dt>
              <dd dir="auto">{{ c.speciality || '—' }}</dd>
            </div>
            <div>
              <dt>{{ i18n.t('dossier.diploma') }}</dt>
              <dd dir="auto">{{ c.diploma || '—' }}</dd>
            </div>
            <div>
              <dt>{{ i18n.t('candidateDetail.skills') }}</dt>
              <dd dir="auto">{{ c.skills || '—' }}</dd>
            </div>
            <div>
              <dt>{{ i18n.t('candidateDetail.languages') }}</dt>
              <dd dir="auto">{{ c.languages || '—' }}</dd>
            </div>
          </dl>
        </section>
      </div>

      <section class="st-card" [attr.aria-label]="i18n.t('candidateDetail.applications')">
        <h2 class="st-card__title">{{ i18n.t('candidateDetail.applications') }}</h2>
        @if (applications().length === 0) {
          <st-alert tone="info">{{ i18n.t('candidateDetail.noApplications') }}</st-alert>
        } @else {
          <ul class="st-apps">
            @for (a of applications(); track a.id) {
              <li>
                <a [routerLink]="['/applications', a.id]" class="st-app">
                  <strong dir="ltr">{{ a.reference }}</strong>
                  <st-badge [label]="a.status" [tone]="statusTone(a.status)" />
                  <span class="st-hint" dir="ltr">{{
                    (a.submissionDate ?? '').slice(0, 10) || '—'
                  }}</span>
                </a>
              </li>
            }
          </ul>
        }
      </section>
    }
  `,
  styles: [
    `
      .st-grid {
        display: grid;
        gap: 0.75rem;
        grid-template-columns: 1fr 1fr;
      }
      .st-card {
        background: var(--bg-surface);
        border: 1px solid var(--border-subtle);
        border-radius: 0.7rem;
        padding: 1rem;
        margin-block-start: 0.8rem;
      }
      .st-grid .st-card {
        margin-block-start: 0;
      }
      .st-card__title {
        margin: 0 0 0.6rem;
        font-size: 0.95rem;
      }
      .st-defs {
        display: grid;
        gap: 0.5rem;
        margin: 0;
      }
      .st-defs div {
        display: grid;
        grid-template-columns: 9rem 1fr;
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
      .st-hint {
        font-size: 0.78rem;
        color: var(--text-secondary);
      }
      .st-cin {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex-wrap: wrap;
        margin-block-start: 0.7rem;
        padding: 0.6rem 0.7rem;
        border: 1px dashed var(--border-default);
        border-radius: 0.55rem;
        font-size: 0.85rem;
      }
      .st-apps {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 0.5rem;
      }
      .st-app {
        display: flex;
        gap: 0.6rem;
        align-items: center;
        flex-wrap: wrap;
        padding: 0.6rem 0.75rem;
        border: 1px solid var(--border-subtle);
        border-radius: 0.55rem;
        text-decoration: none;
        color: inherit;
      }
      .st-app:hover {
        border-color: var(--action-primary);
      }
      @media (max-width: 900px) {
        .st-grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class CandidateDetailComponent implements OnInit {
  readonly i18n = inject(I18nService);
  private readonly crumbs = inject(BreadcrumbService);
  private readonly api = inject(ApiClient);
  private readonly realtime = inject(RealtimeService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly error = signal(false);
  readonly candidate = signal<CandidateDetail | null>(null);
  readonly applications = signal<readonly ApplicationDetail[]>([]);
  readonly cinRevealed = signal(false);

  ngOnInit(): void {
    this.crumbs.set([
      { labelKey: 'nav.candidates', labelFallback: 'Candidates', url: '/candidates' },
      { labelKey: 'candidateDetail.title', labelFallback: 'Candidate' },
    ]);
    this.load();
    this.realtime.candidateUpdates$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((e) => {
      const currentId = this.route.snapshot.paramMap.get('id');
      if (!e.entityId || e.entityId === currentId) this.load();
    });
  }

  load(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      void this.router.navigate(['/candidates']);
      return;
    }
    this.loading.set(true);
    this.error.set(false);
    forkJoin({
      candidate: this.api.getCandidate(id),
      applications: this.api
        .listApplications()
        .pipe(catchError(() => of([] as ApplicationDetail[]))),
    }).subscribe({
      next: ({ candidate, applications }) => {
        this.candidate.set(candidate);
        this.applications.set(applications.filter((a) => a.candidateId === candidate.id));
        this.cinRevealed.set(false);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  statusTone(status: string): 'success' | 'error' | 'warning' | 'info' | 'neutral' {
    switch (status) {
      case 'ACCEPTED':
        return 'success';
      case 'REJECTED':
      case 'WITHDRAWN':
        return 'error';
      case 'NEEDS_CORRECTION':
      case 'DRAFT':
        return 'warning';
      case 'SUBMITTED':
      case 'UNDER_REVIEW':
        return 'info';
      default:
        return 'neutral';
    }
  }
}
