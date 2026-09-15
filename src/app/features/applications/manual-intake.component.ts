import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { I18nService } from '../../core/i18n.service';
import { BreadcrumbService } from '../../core/breadcrumb.service';
import { ApiClient } from '../../core/api-client.service';
import { ToastService } from '../../shared/ui/toast.service';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { AlertComponent } from '../../shared/ui/alert.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { StIconComponent } from '../../shared/ui/icon.component';
import type { ManualApplicationResult, University, ApiErrorEnvelope } from '../../core/api-models';

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];

/**
 * Manual intake for walk-in candidates. Submits the same multipart
 * anonymous-application contract the public site uses, so the stored
 * InternshipApplication model is identical to online applications.
 * Source is read back from `submittedOnline`; backend validation (including
 * Tika content checks) remains authoritative — client checks are UX only.
 */
@Component({
  selector: 'st-manual-intake',
  standalone: true,
  imports: [
    RouterLink,
    FormsModule,
    PageHeaderComponent,
    AlertComponent,
    SkeletonComponent,
    StIconComponent,
  ],
  template: `
    <st-page-header [title]="i18n.t('intake.title')" [subtitle]="i18n.t('intake.subtitle')">
      <a routerLink="/applications" class="st-btn st-btn--secondary">{{ i18n.t('common.back') }}</a>
    </st-page-header>

    @if (done(); as result) {
      <st-alert tone="success" [title]="i18n.t('intake.successTitle')">
        <span dir="ltr"
          ><strong>{{ result.reference }}</strong></span
        >
      </st-alert>
      <section class="st-card" aria-label="tracking token">
        <h2 class="st-card__title">{{ i18n.t('intake.tokenTitle') }}</h2>
        <p class="st-hint">{{ i18n.t('intake.tokenHint') }}</p>
        <p class="st-token" dir="ltr">{{ result.trackingToken }}</p>
        <p>
          <a routerLink="/applications" class="st-btn st-btn--primary">
            {{ i18n.t('intake.backToQueue') }}
          </a>
          <button type="button" class="st-btn st-btn--secondary" (click)="reset()">
            {{ i18n.t('intake.newEntry') }}
          </button>
        </p>
      </section>
    } @else {
      <form class="st-card st-form" (ngSubmit)="submit()" #form="ngForm" novalidate>
        <h2 class="st-card__title">{{ i18n.t('intake.candidateSection') }}</h2>
        <div class="st-grid2">
          <label class="st-field">
            <span class="st-field__label">{{ i18n.t('intake.firstName') }} *</span>
            <input
              class="st-input"
              name="firstName"
              required
              [(ngModel)]="fields.firstName"
              dir="auto"
            />
          </label>
          <label class="st-field">
            <span class="st-field__label">{{ i18n.t('intake.lastName') }} *</span>
            <input
              class="st-input"
              name="lastName"
              required
              [(ngModel)]="fields.lastName"
              dir="auto"
            />
          </label>
          <label class="st-field">
            <span class="st-field__label">{{ i18n.t('intake.email') }} *</span>
            <input
              class="st-input"
              name="email"
              type="email"
              required
              [(ngModel)]="fields.email"
              dir="ltr"
            />
          </label>
          <label class="st-field">
            <span class="st-field__label">{{ i18n.t('intake.phone') }}</span>
            <input class="st-input" name="phone" [(ngModel)]="fields.phone" dir="ltr" />
          </label>
          <label class="st-field">
            <span class="st-field__label">{{ i18n.t('intake.birthDate') }}</span>
            <input class="st-input" name="birthDate" type="date" [(ngModel)]="fields.birthDate" />
          </label>
          <label class="st-field">
            <span class="st-field__label">{{ i18n.t('intake.nationalId') }} *</span>
            <input
              class="st-input"
              name="nationalId"
              required
              [(ngModel)]="fields.nationalId"
              dir="ltr"
              autocomplete="off"
            />
          </label>
          <label class="st-field">
            <span class="st-field__label">{{ i18n.t('intake.university') }} *</span>
            @if (universitiesLoading()) {
              <st-skeleton [rows]="1" />
            } @else {
              <select
                class="st-input"
                name="universityId"
                required
                [(ngModel)]="fields.universityId"
              >
                <option value="">—</option>
                @for (u of universities(); track u.id) {
                  <option [value]="u.id">{{ u.name }}</option>
                }
              </select>
            }
          </label>
          <label class="st-field">
            <span class="st-field__label">{{ i18n.t('intake.speciality') }}</span>
            <input class="st-input" name="speciality" [(ngModel)]="fields.speciality" dir="auto" />
          </label>
          <label class="st-field">
            <span class="st-field__label">{{ i18n.t('intake.diploma') }}</span>
            <input class="st-input" name="diploma" [(ngModel)]="fields.diploma" dir="auto" />
          </label>
        </div>
        <st-alert tone="warning">{{ i18n.t('intake.cinWarning') }}</st-alert>

        <h2 class="st-card__title">{{ i18n.t('intake.internshipSection') }}</h2>
        <div class="st-grid2">
          <label class="st-field">
            <span class="st-field__label">{{ i18n.t('intake.startDate') }} *</span>
            <input
              class="st-input"
              name="startDate"
              type="date"
              required
              [(ngModel)]="fields.desiredStartDate"
            />
          </label>
          <label class="st-field">
            <span class="st-field__label">{{ i18n.t('intake.endDate') }} *</span>
            <input
              class="st-input"
              name="endDate"
              type="date"
              required
              [(ngModel)]="fields.desiredEndDate"
            />
          </label>
        </div>
        <p class="st-hint">{{ i18n.t('intake.classificationHint') }}</p>

        <h2 class="st-card__title">{{ i18n.t('intake.documentsSection') }}</h2>
        <label class="st-field">
          <span class="st-field__label">{{ i18n.t('intake.files') }}</span>
          <input
            class="st-input"
            type="file"
            multiple
            accept=".pdf,.png,.jpg,.jpeg,.webp"
            (change)="onFiles($event)"
            [attr.aria-describedby]="fileError() ? 'files-error' : null"
          />
          @if (fileError()) {
            <span class="st-field__error" role="alert" id="files-error">{{ fileError() }}</span>
          }
        </label>
        @if (fileNames().length > 0) {
          <ul class="st-files">
            @for (name of fileNames(); track name) {
              <li dir="auto">{{ name }}</li>
            }
          </ul>
        }
        <p class="st-hint">{{ i18n.t('intake.filesHint') }}</p>

        @if (formError()) {
          <st-alert tone="error" [title]="i18n.t('common.error.title')">{{ formError() }}</st-alert>
        }
        @if (fieldErrors().length > 0) {
          <ul class="st-field-errors">
            @for (fe of fieldErrors(); track fe.field) {
              <li dir="auto">{{ fe.field }} — {{ fe.message }}</li>
            }
          </ul>
        }

        <p class="st-actions">
          <button type="submit" class="st-btn st-btn--primary" [disabled]="busy() || !form.valid">
            <st-icon name="check" [size]="15" /> {{ i18n.t('intake.submit') }}
          </button>
        </p>
      </form>
    }
  `,
  styles: [
    `
      .st-card {
        background: var(--bg-surface);
        border: 1px solid var(--border-subtle);
        border-radius: 0.7rem;
        padding: 1rem;
        margin-block-end: 0.8rem;
      }
      .st-card__title {
        margin: 0.4rem 0 0.6rem;
        font-size: 0.95rem;
      }
      .st-form {
        display: grid;
        gap: 0.6rem;
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
      .st-files {
        margin: 0;
        padding-inline-start: 1.2rem;
        font-size: 0.83rem;
      }
      .st-field-errors {
        margin: 0;
        padding: 0.6rem 0.8rem;
        padding-inline-start: 1.6rem;
        border: 1px solid var(--border-default);
        border-inline-start: 3px solid var(--status-error);
        border-radius: 0.5rem;
        font-size: 0.82rem;
      }
      .st-actions {
        display: flex;
        gap: 0.5rem;
        margin: 0.4rem 0 0;
      }
      .st-token {
        font-size: 1.1rem;
        font-weight: 700;
        letter-spacing: 0.04em;
        background: var(--bg-page);
        border: 1px dashed var(--border-default);
        border-radius: 0.55rem;
        padding: 0.7rem 0.9rem;
        overflow-wrap: anywhere;
      }
      @media (max-width: 700px) {
        .st-grid2 {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class ManualIntakeComponent implements OnInit {
  readonly i18n = inject(I18nService);
  private readonly crumbs = inject(BreadcrumbService);
  private readonly api = inject(ApiClient);
  private readonly toast = inject(ToastService);

  readonly fields = {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    birthDate: '',
    nationalId: '',
    universityId: '',
    speciality: '',
    diploma: '',
    desiredStartDate: '',
    desiredEndDate: '',
  };

  readonly universities = signal<readonly University[]>([]);
  readonly universitiesLoading = signal(true);
  readonly busy = signal(false);
  readonly done = signal<ManualApplicationResult | null>(null);
  readonly formError = signal('');
  readonly fieldErrors = signal<readonly { field: string; message: string }[]>([]);
  readonly fileError = signal('');
  readonly fileNames = signal<readonly string[]>([]);
  private files: File[] = [];

  ngOnInit(): void {
    this.crumbs.set([
      { labelKey: 'nav.section.operations', labelFallback: 'Operations' },
      { labelKey: 'nav.applications', labelFallback: 'Applications', url: '/applications' },
      { labelKey: 'intake.title', labelFallback: 'Manual intake' },
    ]);
    this.api.listUniversities().subscribe({
      next: (list) => {
        this.universities.set(list.filter((u) => u.active));
        this.universitiesLoading.set(false);
      },
      error: () => this.universitiesLoading.set(false),
    });
  }

  onFiles(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const selected = [...(input?.files ?? [])];
    this.fileError.set('');
    for (const file of selected) {
      if (!ALLOWED_MIME.includes(file.type) && file.size > 0) {
        this.fileError.set(this.i18n.t('intake.fileTypeError'));
        return;
      }
      if (file.size > MAX_FILE_BYTES) {
        this.fileError.set(this.i18n.t('intake.fileSizeError'));
        return;
      }
    }
    this.files = selected;
    this.fileNames.set(selected.map((f) => `${f.name} (${formatSize(f.size)})`));
  }

  submit(): void {
    if (!this.fields.firstName.trim() || !this.fields.lastName.trim() || !this.fields.email.trim())
      return;
    if (!this.fields.nationalId.trim() || !this.fields.universityId) return;
    if (!this.fields.desiredStartDate || !this.fields.desiredEndDate) return;
    this.busy.set(true);
    this.formError.set('');
    this.fieldErrors.set([]);
    this.api.submitManualApplication({ ...this.fields }, this.files).subscribe({
      next: (result) => {
        this.busy.set(false);
        this.done.set(result);
        this.toast.show('success', this.i18n.t('intake.successTitle'));
      },
      error: (e: unknown) => {
        this.busy.set(false);
        const envelope = (e as { error?: ApiErrorEnvelope }).error;
        if (envelope?.fieldErrors?.length) this.fieldErrors.set(envelope.fieldErrors);
        this.formError.set(envelope?.message || this.i18n.t('common.error.body'));
      },
    });
  }

  reset(): void {
    this.done.set(null);
    this.formError.set('');
    this.fieldErrors.set([]);
    this.fileError.set('');
    this.fileNames.set([]);
    this.files = [];
    for (const key of Object.keys(this.fields) as (keyof typeof this.fields)[]) {
      this.fields[key] = '';
    }
  }
}

function formatSize(bytes: number): string {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
