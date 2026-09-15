import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { forkJoin, of, catchError } from 'rxjs';
import { I18nService } from '../../core/i18n.service';
import { BreadcrumbService } from '../../core/breadcrumb.service';
import { AuthService } from '../../core/auth.service';
import { ApiClient } from '../../core/api-client.service';
import { InternshipService } from './internship.service';
import { ToastService } from '../../shared/ui/toast.service';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { AlertComponent } from '../../shared/ui/alert.component';
import { TabsComponent } from '../../shared/ui/tabs.component';
import { StIconComponent } from '../../shared/ui/icon.component';
import type { ApplicationDetail, CandidateSummary } from '../../core/api-models';

/**
 * Internship creation (ADMIN/HR). Two explicit sources, never mixed:
 * from an ACCEPTED application (immutable source data copied backend-side)
 * or manual registration for a candidate. Classification always comes back
 * from the backend response — shown, never computed here.
 */
@Component({
  selector: 'st-internship-create',
  standalone: true,
  imports: [
    RouterLink,
    FormsModule,
    PageHeaderComponent,
    SkeletonComponent,
    AlertComponent,
    TabsComponent,
    StIconComponent,
  ],
  template: `
    <st-page-header
      [title]="i18n.t('internshipCreate.title')"
      [subtitle]="i18n.t('internshipCreate.subtitle')"
    >
      <a routerLink="/internships" class="st-btn st-btn--secondary">{{ i18n.t('common.back') }}</a>
    </st-page-header>

    <st-tabs [tabs]="modeTabs()" [activeId]="mode()" label="Source" (select)="mode.set($event)" />

    @if (mode() === 'from-application') {
      <section class="st-card">
        <h2 class="st-card__title">{{ i18n.t('internshipCreate.fromApplication') }}</h2>
        <st-alert tone="info">{{ i18n.t('internshipCreate.fromApplicationHint') }}</st-alert>
        @if (loadingApp()) {
          <st-skeleton [rows]="4" />
        } @else if (application(); as app) {
          <dl class="st-defs">
            <div>
              <dt>{{ i18n.t('internshipCreate.application') }}</dt>
              <dd dir="ltr">{{ app.reference }} · {{ app.status }}</dd>
            </div>
            <div>
              <dt>{{ i18n.t('internshipCreate.candidate') }}</dt>
              <dd dir="auto">{{ app.candidateName }}</dd>
            </div>
            <div>
              <dt>{{ i18n.t('internshipCreate.period') }}</dt>
              <dd dir="ltr">{{ app.desiredStartDate }} → {{ app.desiredEndDate }}</dd>
            </div>
            <div>
              <dt>{{ i18n.t('internshipCreate.sourceType') }}</dt>
              <dd>{{ app.calculatedType ?? '—' }} · {{ app.requirement ?? '' }}</dd>
            </div>
          </dl>
          @if (app.status !== 'ACCEPTED') {
            <st-alert tone="error" [title]="i18n.t('internshipCreate.notAcceptedTitle')">
              {{ i18n.t('internshipCreate.notAcceptedBody') }}
            </st-alert>
          }
          @if (app.calculatedType === 'OBSERVATION') {
            <fieldset class="st-radio">
              <legend>{{ i18n.t('internshipDetail.observationFlag') }}</legend>
              <label>
                <input
                  type="radio"
                  name="obsflag"
                  [value]="true"
                  [(ngModel)]="observationObligatoire"
                />
                {{ i18n.t('internshipDetail.obligatoire') }}
              </label>
              <label>
                <input
                  type="radio"
                  name="obsflag"
                  [value]="false"
                  [(ngModel)]="observationObligatoire"
                />
                {{ i18n.t('internshipDetail.optional') }}
              </label>
            </fieldset>
          }
          @if (formError()) {
            <st-alert tone="error">{{ formError() }}</st-alert>
          }
          <p>
            <button
              type="button"
              class="st-btn st-btn--primary"
              [disabled]="busy() || app.status !== 'ACCEPTED'"
              (click)="submitFromApplication()"
            >
              <st-icon name="check" [size]="15" /> {{ i18n.t('internshipCreate.create') }}
            </button>
          </p>
        } @else {
          <label class="st-field">
            <span class="st-field__label">{{ i18n.t('internshipCreate.applicationId') }} *</span>
            <input
              class="st-input"
              [(ngModel)]="applicationIdInput"
              dir="ltr"
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            />
          </label>
          <p>
            <button type="button" class="st-btn st-btn--secondary" (click)="loadApplication()">
              {{ i18n.t('internshipCreate.loadApplication') }}
            </button>
          </p>
          @if (formError()) {
            <st-alert tone="error">{{ formError() }}</st-alert>
          }
        }
      </section>
    } @else {
      <section class="st-card">
        <h2 class="st-card__title">{{ i18n.t('internshipCreate.manual') }}</h2>
        <st-alert tone="info">{{ i18n.t('internshipCreate.manualHint') }}</st-alert>
        @if (loadingRefs()) {
          <st-skeleton [rows]="5" />
        } @else {
          <div class="st-grid2">
            <label class="st-field">
              <span class="st-field__label">{{ i18n.t('internshipCreate.candidate') }} *</span>
              <select class="st-input" [(ngModel)]="manual.candidateId">
                <option value="">—</option>
                @for (c of candidates(); track c.id) {
                  <option [value]="c.id">
                    {{ c.firstName }} {{ c.lastName }} · {{ c.universityName }}
                  </option>
                }
              </select>
            </label>
            <label class="st-field">
              <span class="st-field__label">{{ i18n.t('internshipCreate.subject') }} *</span>
              <input class="st-input" [(ngModel)]="manual.subject" dir="auto" />
            </label>
            <label class="st-field">
              <span class="st-field__label">{{ i18n.t('internshipDetail.startDate') }} *</span>
              <input type="date" class="st-input" [(ngModel)]="manual.startDate" />
            </label>
            <label class="st-field">
              <span class="st-field__label">{{ i18n.t('internshipDetail.endDate') }} *</span>
              <input type="date" class="st-input" [(ngModel)]="manual.endDate" />
            </label>
            <label class="st-field">
              <span class="st-field__label">{{ i18n.t('internshipDetail.academicLevel') }}</span>
              <input class="st-input" [(ngModel)]="manual.academicLevel" dir="auto" />
            </label>
          </div>
          <fieldset class="st-radio">
            <legend>{{ i18n.t('internshipDetail.observationFlag') }}</legend>
            <label>
              <input type="radio" name="obsflagm" [value]="true" [(ngModel)]="manualObservation" />
              {{ i18n.t('internshipDetail.obligatoire') }}
            </label>
            <label>
              <input type="radio" name="obsflagm" [value]="false" [(ngModel)]="manualObservation" />
              {{ i18n.t('internshipDetail.optional') }}
            </label>
          </fieldset>
          <p class="st-hint">{{ i18n.t('internshipCreate.manualObservationNote') }}</p>
          @if (formError()) {
            <st-alert tone="error">{{ formError() }}</st-alert>
          }
          <p>
            <button
              type="button"
              class="st-btn st-btn--primary"
              [disabled]="
                busy() ||
                !manual.candidateId ||
                !manual.subject.trim() ||
                !manual.startDate ||
                !manual.endDate
              "
              (click)="submitManual()"
            >
              <st-icon name="check" [size]="15" /> {{ i18n.t('internshipCreate.create') }}
            </button>
          </p>
        }
      </section>
    }

    @if (created()) {
      <st-alert tone="success" [title]="i18n.t('internshipCreate.createdTitle')">
        <span dir="ltr">
          <strong>{{ created()?.reference }}</strong> · {{ created()?.type }} ·
          {{ created()?.requirement }}
        </span>
      </st-alert>
    }
  `,
  styles: [
    `
      .st-card {
        background: var(--bg-surface);
        border: 1px solid var(--border-subtle);
        border-radius: 0.7rem;
        padding: 1rem;
        margin-block-start: 0.8rem;
        display: grid;
        gap: 0.6rem;
      }
      .st-card__title {
        margin: 0;
        font-size: 0.95rem;
      }
      .st-defs {
        display: grid;
        gap: 0.5rem;
        margin: 0;
      }
      .st-defs div {
        display: grid;
        grid-template-columns: 10rem 1fr;
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
      .st-grid2 {
        display: grid;
        gap: 0.6rem;
        grid-template-columns: 1fr 1fr;
      }
      .st-hint {
        font-size: 0.78rem;
        color: var(--text-secondary);
        margin: 0;
      }
      .st-radio {
        border: 1px solid var(--border-subtle);
        border-radius: 0.55rem;
        padding: 0.6rem 0.8rem;
        display: grid;
        gap: 0.4rem;
        font-size: 0.85rem;
      }
      .st-radio legend {
        font-size: 0.78rem;
        font-weight: 600;
        color: var(--text-secondary);
        padding-inline: 0.3rem;
      }
      .st-radio label {
        display: flex;
        gap: 0.45rem;
        align-items: center;
      }
      @media (max-width: 700px) {
        .st-grid2 {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class InternshipCreateComponent implements OnInit {
  readonly i18n = inject(I18nService);
  readonly auth = inject(AuthService);
  private readonly crumbs = inject(BreadcrumbService);
  private readonly api = inject(ApiClient);
  private readonly service = inject(InternshipService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly mode = signal('from-application');
  readonly busy = signal(false);
  readonly formError = signal('');
  readonly loadingApp = signal(false);
  readonly loadingRefs = signal(true);
  readonly application = signal<ApplicationDetail | null>(null);
  readonly candidates = signal<readonly CandidateSummary[]>([]);
  readonly created = signal<{ reference: string; type: string; requirement: string } | null>(null);

  applicationIdInput = '';
  observationObligatoire = false;
  manualObservation = false;
  readonly manual = { candidateId: '', subject: '', startDate: '', endDate: '', academicLevel: '' };

  modeTabs(): { id: string; label: string }[] {
    return [
      { id: 'from-application', label: this.i18n.t('internshipCreate.fromApplication') },
      { id: 'manual', label: this.i18n.t('internshipCreate.manual') },
    ];
  }

  ngOnInit(): void {
    this.crumbs.set([
      { labelKey: 'nav.internships', labelFallback: 'Internships', url: '/internships' },
      { labelKey: 'internshipCreate.title', labelFallback: 'New internship' },
    ]);
    const preset = this.route.snapshot.queryParamMap.get('applicationId');
    if (preset) {
      this.mode.set('from-application');
      this.applicationIdInput = preset;
      this.loadApplication();
    }
    this.api
      .listCandidates()
      .pipe(catchError(() => of([] as CandidateSummary[])))
      .subscribe({
        next: (rows) => {
          this.candidates.set(rows);
          this.loadingRefs.set(false);
        },
        error: () => this.loadingRefs.set(false),
      });
  }

  loadApplication(): void {
    const id = this.applicationIdInput.trim();
    if (!id) return;
    this.loadingApp.set(true);
    this.formError.set('');
    this.api.getApplication(id).subscribe({
      next: (app) => {
        this.application.set(app);
        this.observationObligatoire = app.requirement === 'OBLIGATOIRE';
        this.loadingApp.set(false);
      },
      error: (e: unknown) => {
        this.loadingApp.set(false);
        this.formError.set(extractMessage(e, this.i18n));
      },
    });
  }

  submitFromApplication(): void {
    const app = this.application();
    if (!app || app.status !== 'ACCEPTED') return;
    this.busy.set(true);
    this.formError.set('');
    this.service
      .createFromApplication({
        applicationId: app.id,
        // Only meaningful for observation; omitted otherwise.
        observationObligatoire:
          app.calculatedType === 'OBSERVATION' ? this.observationObligatoire : null,
      })
      .subscribe({
        next: (created) => {
          this.busy.set(false);
          this.created.set({
            reference: created.reference,
            type: created.type,
            requirement: created.requirement,
          });
          this.toast.show('success', this.i18n.t('internshipCreate.createdTitle'));
          void this.router.navigate(['/internships', created.id]);
        },
        error: (e: unknown) => {
          this.busy.set(false);
          this.formError.set(extractMessage(e, this.i18n));
        },
      });
  }

  submitManual(): void {
    if (
      !this.manual.candidateId ||
      !this.manual.subject.trim() ||
      !this.manual.startDate ||
      !this.manual.endDate
    ) {
      return;
    }
    if (this.manual.endDate < this.manual.startDate) {
      this.formError.set(this.i18n.t('internshipDetail.datesInvalid'));
      return;
    }
    this.busy.set(true);
    this.formError.set('');
    this.service
      .createManual({
        candidateId: this.manual.candidateId,
        startDate: this.manual.startDate,
        endDate: this.manual.endDate,
        subject: this.manual.subject.trim(),
        ...(this.manual.academicLevel.trim()
          ? { academicLevel: this.manual.academicLevel.trim() }
          : {}),
        observationObligatoire: this.manualObservation,
      })
      .subscribe({
        next: (created) => {
          this.busy.set(false);
          this.created.set({
            reference: created.reference,
            type: created.type,
            requirement: created.requirement,
          });
          this.toast.show('success', this.i18n.t('internshipCreate.createdTitle'));
          void this.router.navigate(['/internships', created.id]);
        },
        error: (e: unknown) => {
          this.busy.set(false);
          this.formError.set(extractMessage(e, this.i18n));
        },
      });
  }
}

function extractMessage(error: unknown, i18n: I18nService): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    (error as { status?: number }).status === 403
  ) {
    return i18n.t('common.forbidden.body');
  }
  if (typeof error === 'object' && error !== null) {
    const envelope = (error as { error?: { message?: string } }).error;
    if (envelope?.message) return envelope.message;
  }
  return i18n.t('common.error.body');
}
