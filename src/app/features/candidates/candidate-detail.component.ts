import { Component, inject, signal, OnInit, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { forkJoin, of, catchError } from 'rxjs';
import { I18nService } from '../../core/i18n.service';
import { BreadcrumbService } from '../../core/breadcrumb.service';
import { RealtimeService } from '../../core/realtime.service';
import { AuthService } from '../../core/auth.service';
import { ApiClient } from '../../core/api-client.service';
import { ToastService } from '../../shared/ui/toast.service';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { LiveStatusComponent } from '../../shared/ui/live-status.component';
import { BadgeComponent } from '../../shared/ui/badge.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { ErrorStateComponent } from '../../shared/ui/states.component';
import { AlertComponent } from '../../shared/ui/alert.component';
import { DialogComponent } from '../../shared/ui/dialog.component';
import type { ApplicationDetail, CandidateDetail, University } from '../../core/api-models';

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
    FormsModule,
    PageHeaderComponent,
    LiveStatusComponent,
    BadgeComponent,
    SkeletonComponent,
    ErrorStateComponent,
    AlertComponent,
    DialogComponent,
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
        @if (canEdit()) {
          <button type="button" class="st-btn st-btn--primary" (click)="openEdit()">
            {{ i18n.t('common.edit') }}
          </button>
        }
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

      <!-- Staff profile correction -->
      <st-dialog
        [open]="editOpen()"
        [title]="i18n.t('candidateDetail.editTitle')"
        (close)="editOpen.set(false)"
      >
        <div class="st-grid2">
          <label class="st-field">
            <span class="st-field__label">{{ i18n.t('dossier.firstName') }} *</span>
            <input type="text" class="st-input" [(ngModel)]="editForm.firstName" dir="auto" />
          </label>
          <label class="st-field">
            <span class="st-field__label">{{ i18n.t('dossier.lastName') }} *</span>
            <input type="text" class="st-input" [(ngModel)]="editForm.lastName" dir="auto" />
          </label>
          <label class="st-field">
            <span class="st-field__label">{{ i18n.t('dossier.email') }} *</span>
            <input type="email" class="st-input" [(ngModel)]="editForm.email" dir="ltr" />
          </label>
          <label class="st-field">
            <span class="st-field__label">{{ i18n.t('dossier.phone') }}</span>
            <input type="tel" class="st-input" [(ngModel)]="editForm.phone" dir="ltr" />
          </label>
          <label class="st-field">
            <span class="st-field__label">{{ i18n.t('dossier.birthDate') }}</span>
            <input type="date" class="st-input" [(ngModel)]="editForm.birthDate" />
          </label>
          <label class="st-field">
            <span class="st-field__label">{{ i18n.t('dossier.university') }} *</span>
            <select class="st-input" [(ngModel)]="editForm.universityId">
              <option value="">—</option>
              @for (u of universities(); track u.id) {
                <option [value]="u.id">{{ u.name }}</option>
              }
            </select>
          </label>
          <label class="st-field">
            <span class="st-field__label">{{ i18n.t('dossier.speciality') }}</span>
            <input type="text" class="st-input" [(ngModel)]="editForm.speciality" dir="auto" />
          </label>
          <label class="st-field">
            <span class="st-field__label">{{ i18n.t('dossier.diploma') }}</span>
            <input type="text" class="st-input" [(ngModel)]="editForm.diploma" dir="auto" />
          </label>
          <label class="st-field st-field--full">
            <span class="st-field__label">{{ i18n.t('dossier.address') }}</span>
            <input type="text" class="st-input" [(ngModel)]="editForm.address" dir="auto" />
          </label>
          <label class="st-field">
            <span class="st-field__label">{{ i18n.t('candidateDetail.skills') }}</span>
            <input type="text" class="st-input" [(ngModel)]="editForm.skills" dir="auto" />
          </label>
          <label class="st-field">
            <span class="st-field__label">{{ i18n.t('candidateDetail.languages') }}</span>
            <input type="text" class="st-input" [(ngModel)]="editForm.languages" dir="auto" />
          </label>
          <label class="st-field st-field--full">
            <span class="st-field__label">{{ i18n.t('dossier.nationalId') }} *</span>
            <input
              type="text"
              class="st-input"
              [(ngModel)]="editForm.nationalId"
              dir="ltr"
              inputmode="numeric"
              autocomplete="off"
            />
          </label>
        </div>
        <p class="st-hint">{{ i18n.t('candidateDetail.editHint') }}</p>
        @if (editError()) {
          <st-alert tone="error">{{ editError() }}</st-alert>
        }
        <div slot="footer" class="st-dialog__actions">
          <button type="button" class="st-btn st-btn--secondary" (click)="editOpen.set(false)">
            {{ i18n.t('common.cancel') }}
          </button>
          <button
            type="button"
            class="st-btn st-btn--primary"
            [disabled]="busy() || !editValid()"
            (click)="saveEdit()"
          >
            {{ i18n.t('common.save') }}
          </button>
        </div>
      </st-dialog>
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
      .st-grid2 {
        display: grid;
        gap: 0.6rem;
        grid-template-columns: 1fr 1fr;
      }
      .st-field--full {
        grid-column: 1 / -1;
      }
      .st-dialog__actions {
        display: flex;
        gap: 0.5rem;
        justify-content: flex-end;
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
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly realtime = inject(RealtimeService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal(false);
  readonly candidate = signal<CandidateDetail | null>(null);
  readonly applications = signal<readonly ApplicationDetail[]>([]);
  readonly cinRevealed = signal(false);
  readonly universities = signal<readonly University[]>([]);

  readonly editOpen = signal(false);
  readonly editError = signal('');
  readonly editForm = {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    birthDate: '',
    universityId: '',
    speciality: '',
    diploma: '',
    address: '',
    skills: '',
    languages: '',
    nationalId: '',
  };

  canEdit(): boolean {
    return this.auth.hasPermission('APPLICATION_REVIEW');
  }

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

  openEdit(): void {
    const c = this.candidate();
    if (!c) return;
    this.editForm.firstName = c.firstName;
    this.editForm.lastName = c.lastName;
    this.editForm.email = c.email;
    this.editForm.phone = c.phone ?? '';
    this.editForm.birthDate = c.birthDate ?? '';
    this.editForm.universityId = c.universityId;
    this.editForm.speciality = c.speciality ?? '';
    this.editForm.diploma = c.diploma ?? '';
    this.editForm.address = c.address ?? '';
    this.editForm.skills = c.skills ?? '';
    this.editForm.languages = c.languages ?? '';
    // CIN is never prefilled in cleartext: the masked value cannot round-trip.
    this.editForm.nationalId = '';
    this.editError.set('');
    if (this.universities().length === 0) {
      this.api.listUniversities().subscribe({
        next: (rows) => this.universities.set(rows.filter((u) => u.active)),
        error: () => this.universities.set([]),
      });
    }
    this.editOpen.set(true);
  }

  editValid(): boolean {
    return (
      this.editForm.firstName.trim() !== '' &&
      this.editForm.lastName.trim() !== '' &&
      this.editForm.email.trim() !== '' &&
      this.editForm.universityId !== '' &&
      this.editForm.nationalId.trim() !== ''
    );
  }

  saveEdit(): void {
    const c = this.candidate();
    if (!c || !this.editValid()) return;
    this.busy.set(true);
    this.editError.set('');
    const opt = (v: string): string | null => (v.trim() ? v.trim() : null);
    this.api
      .updateCandidate(c.id, {
        firstName: this.editForm.firstName.trim(),
        lastName: this.editForm.lastName.trim(),
        email: this.editForm.email.trim(),
        phone: opt(this.editForm.phone),
        birthDate: opt(this.editForm.birthDate),
        address: opt(this.editForm.address),
        speciality: opt(this.editForm.speciality),
        diploma: opt(this.editForm.diploma),
        skills: opt(this.editForm.skills),
        languages: opt(this.editForm.languages),
        universityId: this.editForm.universityId,
        nationalId: this.editForm.nationalId.trim(),
      })
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.editOpen.set(false);
          this.toast.show('success', this.i18n.t('candidateDetail.editSaved'));
          this.load();
        },
        error: (e: unknown) => {
          this.busy.set(false);
          const envelope = (e as { error?: { message?: string } }).error;
          this.editError.set(envelope?.message ?? this.i18n.t('common.error.body'));
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
