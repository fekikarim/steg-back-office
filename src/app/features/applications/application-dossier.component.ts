import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { I18nService } from '../../core/i18n.service';
import { BreadcrumbService } from '../../core/breadcrumb.service';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../shared/ui/toast.service';
import { ApplicationReviewService, type DossierBundle } from './application-review.service';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { BadgeComponent, type BadgeTone } from '../../shared/ui/badge.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { EmptyStateComponent, ErrorStateComponent } from '../../shared/ui/states.component';
import { AlertComponent } from '../../shared/ui/alert.component';
import { TabsComponent } from '../../shared/ui/tabs.component';
import { DialogComponent, ConfirmDialogComponent } from '../../shared/ui/dialog.component';
import { StIconComponent } from '../../shared/ui/icon.component';
import type { ApplicationDocumentItem } from '../../core/api-models';

type ReasonKind = 'reject' | 'correct' | 'accept-note' | 'verify';

/**
 * Application dossier: candidate data, backend-derived classification,
 * documents with verification, real workflow timeline and review actions.
 * All mutations go through backend workflow endpoints; the client never
 * decides transition legality.
 */
@Component({
  selector: 'st-application-dossier',
  standalone: true,
  imports: [
    RouterLink,
    FormsModule,
    PageHeaderComponent,
    BadgeComponent,
    SkeletonComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    AlertComponent,
    TabsComponent,
    DialogComponent,
    ConfirmDialogComponent,
    StIconComponent,
  ],
  template: `
    @if (loading()) {
      <st-skeleton [rows]="10" />
    } @else if (error()) {
      <st-error-state
        [title]="i18n.t('common.error.title')"
        [body]="errorMessage() || i18n.t('common.error.body')"
        [retryLabel]="i18n.t('common.retry')"
        (retry)="load()"
      />
      <p>
        <a routerLink="/applications" class="st-btn st-btn--secondary">{{
          i18n.t('common.back')
        }}</a>
      </p>
    } @else if (bundle(); as dossier) {
      <st-page-header
        [title]="dossier.application.reference"
        [subtitle]="dossier.application.candidateName"
      >
        <a routerLink="/applications" class="st-btn st-btn--secondary">{{
          i18n.t('common.back')
        }}</a>
        @if (canAct() && canBeginReview(dossier.application.status)) {
          <button
            type="button"
            class="st-btn st-btn--primary"
            (click)="beginReview()"
            [disabled]="busy()"
          >
            {{ i18n.t('dossier.beginReview') }}
          </button>
        }
        @if (canAct() && dossier.application.status === 'UNDER_REVIEW') {
          <button
            type="button"
            class="st-btn st-btn--primary"
            (click)="openReason('accept-note')"
            [disabled]="busy()"
          >
            {{ i18n.t('dossier.accept') }}
          </button>
          <button
            type="button"
            class="st-btn st-btn--secondary"
            (click)="openReason('correct')"
            [disabled]="busy()"
          >
            {{ i18n.t('dossier.requestCorrection') }}
          </button>
          <button
            type="button"
            class="st-btn st-btn--danger"
            (click)="openReason('reject')"
            [disabled]="busy()"
          >
            {{ i18n.t('dossier.reject') }}
          </button>
        }
        @if (canCreateInternship() && dossier.application.status === 'ACCEPTED') {
          <a
            [routerLink]="['/internships/new']"
            [queryParams]="{ applicationId: dossier.application.id }"
            class="st-btn st-btn--primary"
          >
            {{ i18n.t('dossier.createInternship') }}
          </a>
        }
      </st-page-header>

      <p class="st-flags">
        <st-badge
          [label]="dossier.application.status"
          [tone]="statusTone(dossier.application.status)"
        />
        <st-badge
          [label]="
            dossier.application.submittedOnline
              ? i18n.t('applications.online')
              : i18n.t('applications.manual')
          "
          tone="neutral"
        />
        @if (dossier.application.calculatedType) {
          <st-badge [label]="dossier.application.calculatedType" tone="info" />
        }
        @if (dossier.application.requirement) {
          <st-badge [label]="dossier.application.requirement" tone="neutral" />
        }
      </p>

      @if (dossier.application.status === 'REJECTED' && dossier.application.rejectionReason) {
        <st-alert tone="error" [title]="i18n.t('dossier.rejectionReason')">
          <span dir="auto">{{ dossier.application.rejectionReason }}</span>
        </st-alert>
      }
      @if (
        dossier.application.status === 'NEEDS_CORRECTION' && dossier.application.correctionComment
      ) {
        <st-alert tone="warning" [title]="i18n.t('dossier.correctionComment')">
          <span dir="auto">{{ dossier.application.correctionComment }}</span>
        </st-alert>
      }

      <st-tabs
        [tabs]="tabs(dossier)"
        [activeId]="tab()"
        label="Dossier"
        (select)="tab.set($event)"
      />

      @if (tab() === 'overview') {
        <div class="st-grid">
          <section class="st-card" [attr.aria-label]="i18n.t('dossier.candidate')">
            <h2 class="st-card__title">{{ i18n.t('dossier.candidate') }}</h2>
            @if (dossier.candidate; as c) {
              <dl class="st-defs">
                <div>
                  <dt>{{ i18n.t('dossier.fullName') }}</dt>
                  <dd dir="auto">{{ c.firstName }} {{ c.lastName }}</dd>
                </div>
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
                @if (c.address) {
                  <div>
                    <dt>{{ i18n.t('dossier.address') }}</dt>
                    <dd dir="auto">{{ c.address }}</dd>
                  </div>
                }
              </dl>
              <div class="st-cin">
                <st-badge [label]="i18n.t('common.sensitive')" tone="restricted" icon="shield" />
                <span class="st-cin__label">{{ i18n.t('dossier.nationalId') }}</span>
                @if (cinRevealed()) {
                  <strong dir="ltr">{{ c.nationalId || '—' }}</strong>
                  <button
                    type="button"
                    class="st-btn st-btn--text"
                    (click)="cinRevealed.set(false)"
                  >
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
              <p>
                <a [routerLink]="['/candidates', c.id]" class="st-btn st-btn--secondary">
                  {{ i18n.t('dossier.openCandidate') }}
                </a>
              </p>
            } @else {
              <st-alert tone="warning">{{ i18n.t('dossier.candidateUnavailable') }}</st-alert>
            }
          </section>

          <section class="st-card" [attr.aria-label]="i18n.t('dossier.internship')">
            <h2 class="st-card__title">{{ i18n.t('dossier.internship') }}</h2>
            <dl class="st-defs">
              <div>
                <dt>{{ i18n.t('dossier.startDate') }}</dt>
                <dd dir="ltr">{{ dossier.application.desiredStartDate }}</dd>
              </div>
              <div>
                <dt>{{ i18n.t('dossier.endDate') }}</dt>
                <dd dir="ltr">{{ dossier.application.desiredEndDate }}</dd>
              </div>
              <div>
                <dt>{{ i18n.t('dossier.computedType') }}</dt>
                <dd>{{ dossier.application.calculatedType ?? '—' }}</dd>
              </div>
              <div>
                <dt>{{ i18n.t('dossier.requirement') }}</dt>
                <dd>{{ dossier.application.requirement ?? '—' }}</dd>
              </div>
              <div>
                <dt>{{ i18n.t('dossier.theme') }}</dt>
                <dd dir="auto">{{ dossier.application.proposedTheme || '—' }}</dd>
              </div>
              <div>
                <dt>{{ i18n.t('dossier.submittedAt') }}</dt>
                <dd dir="ltr">
                  {{ (dossier.application.submissionDate ?? '').slice(0, 10) || '—' }}
                </dd>
              </div>
            </dl>
            <p class="st-hint">{{ i18n.t('dossier.backendDerivedHint') }}</p>
          </section>
        </div>
      }

      @if (tab() === 'documents') {
        <section class="st-card" [attr.aria-label]="i18n.t('dossier.documents')">
          <h2 class="st-card__title">{{ i18n.t('dossier.documents') }}</h2>
          @if (dossier.documents.length === 0) {
            <st-empty-state
              [title]="i18n.t('common.empty.title')"
              [body]="i18n.t('dossier.noDocuments')"
            />
          } @else {
            <ul class="st-docs">
              @for (item of dossier.documents; track item.id) {
                <li class="st-docrow">
                  <div class="st-docrow__meta">
                    <strong dir="auto">{{ item.document.originalFileName }}</strong>
                    <span class="st-docrow__sub" dir="auto">
                      {{ item.document.type }} · {{ formatSize(item.document.sizeBytes) }} ·
                      {{ item.document.mimeType }}
                    </span>
                    <span class="st-docrow__badges">
                      @if (item.mandatory) {
                        <st-badge [label]="i18n.t('dossier.mandatory')" tone="info" />
                      }
                      <st-badge
                        [label]="item.verificationStatus"
                        [tone]="verifyTone(item.verificationStatus)"
                      />
                      @if (item.document.restrictedAccess) {
                        <st-badge
                          [label]="i18n.t('common.sensitive')"
                          tone="restricted"
                          icon="shield"
                        />
                      }
                    </span>
                    @if (item.verificationComment) {
                      <span class="st-docrow__comment" dir="auto">{{
                        item.verificationComment
                      }}</span>
                    }
                  </div>
                  <div class="st-docrow__actions">
                    <button
                      type="button"
                      class="st-btn st-btn--secondary"
                      [disabled]="isRestrictedBlocked(item)"
                      (click)="download(item, false)"
                    >
                      <st-icon name="download" [size]="14" /> {{ i18n.t('common.download') }}
                    </button>
                    @if (canAct()) {
                      <button
                        type="button"
                        class="st-btn st-btn--secondary"
                        (click)="openVerify(item, 'VERIFIED')"
                        [disabled]="busy()"
                      >
                        {{ i18n.t('dossier.verify') }}
                      </button>
                      <button
                        type="button"
                        class="st-btn st-btn--secondary"
                        (click)="openVerify(item, 'REQUIRES_CORRECTION')"
                        [disabled]="busy()"
                      >
                        {{ i18n.t('dossier.requestCorrection') }}
                      </button>
                    }
                  </div>
                </li>
              }
            </ul>
          }
          @if (restrictedBlockedNote()) {
            <st-alert tone="warning">{{ i18n.t('dossier.restrictedBlocked') }}</st-alert>
          }
        </section>
      }

      @if (tab() === 'timeline') {
        <section class="st-card" [attr.aria-label]="i18n.t('dossier.timeline')">
          <h2 class="st-card__title">{{ i18n.t('dossier.timeline') }}</h2>
          @if (dossier.workflow) {
            <p class="st-hint" dir="auto">
              {{ dossier.workflow.definitionName }} · {{ dossier.workflow.currentStepName }} ·
              {{ dossier.workflow.status }}
            </p>
          }
          @if (dossier.actionsRestricted) {
            <st-alert tone="warning">{{ i18n.t('dossier.timelineRestricted') }}</st-alert>
          } @else if (dossier.actions.length === 0) {
            <st-empty-state
              [title]="i18n.t('common.empty.title')"
              [body]="i18n.t('dossier.noActions')"
            />
          } @else {
            <ol class="st-timeline">
              @for (a of dossier.actions; track a.id) {
                <li class="st-timeline__item">
                  <span class="st-timeline__seq" aria-hidden="true">{{ a.sequenceNumber }}</span>
                  <div>
                    <p class="st-timeline__head" dir="auto">
                      <strong>{{ a.stepName }}</strong>
                      <st-badge [label]="a.type" tone="neutral" />
                      <st-badge [label]="a.decision" [tone]="decisionTone(a.decision)" />
                    </p>
                    <p class="st-timeline__meta" dir="auto">
                      {{ a.performedByUsername }} · {{ formatDateTime(a.performedAt) }}
                    </p>
                    @if (a.comment) {
                      <p class="st-timeline__comment" dir="auto">{{ a.comment }}</p>
                    }
                  </div>
                </li>
              }
            </ol>
          }
        </section>
      }

      <!-- Reason dialog (reject / correction / accept note / doc verification) -->
      <st-dialog [open]="reasonKind() !== null" [title]="reasonTitle()" (close)="closeReason()">
        <p class="st-hint">{{ reasonHint() }}</p>
        <label class="st-field">
          <span class="st-field__label">{{ i18n.t('dossier.reasonLabel') }} *</span>
          <textarea
            class="st-input"
            rows="4"
            [(ngModel)]="reasonText"
            dir="auto"
            [attr.aria-describedby]="reasonError() ? 'reason-error' : null"
          ></textarea>
          @if (reasonError()) {
            <span class="st-field__error" role="alert" id="reason-error">{{ reasonError() }}</span>
          }
        </label>
        <div slot="footer" class="st-dialog__actions">
          <button type="button" class="st-btn st-btn--secondary" (click)="closeReason()">
            {{ i18n.t('common.cancel') }}
          </button>
          <button
            type="button"
            class="st-btn"
            [class.st-btn--danger]="reasonKind() === 'reject'"
            [class.st-btn--primary]="reasonKind() !== 'reject'"
            [disabled]="busy()"
            (click)="submitReason()"
          >
            {{ i18n.t('common.confirm') }}
          </button>
        </div>
      </st-dialog>

      <st-confirm-dialog
        [open]="confirmBegin()"
        [title]="i18n.t('dossier.beginReview')"
        [body]="i18n.t('dossier.beginReviewBody')"
        [confirmLabel]="i18n.t('common.confirm')"
        [cancelLabel]="i18n.t('common.cancel')"
        [busy]="busy()"
        (confirmed)="doBeginReview()"
        (cancel)="confirmBegin.set(false)"
      />
    }
  `,
  styles: [
    `
      .st-flags {
        display: flex;
        gap: 0.4rem;
        flex-wrap: wrap;
        margin: 0 0 0.8rem;
      }
      .st-grid {
        display: grid;
        gap: 0.75rem;
        grid-template-columns: 1fr 1fr;
        margin-block-start: 0.8rem;
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
      }
      .st-docs {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 0.6rem;
      }
      .st-docrow {
        display: flex;
        gap: 0.7rem;
        justify-content: space-between;
        align-items: flex-start;
        flex-wrap: wrap;
        border: 1px solid var(--border-subtle);
        border-radius: 0.6rem;
        padding: 0.7rem 0.8rem;
      }
      .st-docrow__meta {
        display: grid;
        gap: 0.25rem;
        flex: 1;
        min-inline-size: 14rem;
      }
      .st-docrow__sub {
        font-size: 0.75rem;
        color: var(--text-muted);
        overflow-wrap: anywhere;
      }
      .st-docrow__badges {
        display: flex;
        gap: 0.35rem;
        flex-wrap: wrap;
      }
      .st-docrow__comment {
        font-size: 0.8rem;
        color: var(--text-secondary);
      }
      .st-docrow__actions {
        display: flex;
        gap: 0.4rem;
        flex-wrap: wrap;
      }
      .st-timeline {
        list-style: none;
        margin: 0.6rem 0 0;
        padding: 0;
        display: grid;
        gap: 0.7rem;
      }
      .st-timeline__item {
        display: flex;
        gap: 0.7rem;
      }
      .st-timeline__seq {
        flex: none;
        inline-size: 1.7rem;
        block-size: 1.7rem;
        border-radius: 50%;
        background: var(--bg-page);
        border: 1px solid var(--border-default);
        display: grid;
        place-items: center;
        font-size: 0.75rem;
        font-weight: 700;
      }
      .st-timeline__head {
        display: flex;
        gap: 0.4rem;
        align-items: center;
        flex-wrap: wrap;
        margin: 0;
        font-size: 0.85rem;
      }
      .st-timeline__meta {
        margin: 0.15rem 0 0;
        font-size: 0.75rem;
        color: var(--text-muted);
      }
      .st-timeline__comment {
        margin: 0.25rem 0 0;
        font-size: 0.83rem;
        padding: 0.45rem 0.6rem;
        background: var(--bg-page);
        border-radius: 0.45rem;
        overflow-wrap: anywhere;
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
export class ApplicationDossierComponent implements OnInit {
  readonly i18n = inject(I18nService);
  readonly auth = inject(AuthService);
  private readonly crumbs = inject(BreadcrumbService);
  private readonly service = inject(ApplicationReviewService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal(false);
  readonly errorMessage = signal('');
  readonly bundle = signal<DossierBundle | null>(null);
  readonly tab = signal('overview');
  readonly cinRevealed = signal(false);

  readonly reasonKind = signal<ReasonKind | null>(null);
  readonly confirmBegin = signal(false);
  readonly restrictedBlockedNote = signal(false);
  reasonText = '';
  readonly reasonError = signal('');
  private verifyTarget: ApplicationDocumentItem | null = null;
  private verifyStatus: 'VERIFIED' | 'REQUIRES_CORRECTION' = 'VERIFIED';

  tabs(dossier: DossierBundle): { id: string; label: string; count?: number }[] {
    return [
      { id: 'overview', label: this.i18n.t('dossier.tabOverview') },
      {
        id: 'documents',
        label: this.i18n.t('dossier.tabDocuments'),
        count: dossier.documents.length,
      },
      { id: 'timeline', label: this.i18n.t('dossier.tabTimeline'), count: dossier.actions.length },
    ];
  }

  canAct(): boolean {
    return this.auth.hasPermission('APPLICATION_REVIEW');
  }

  canCreateInternship(): boolean {
    return this.auth.hasPermission('INTERNSHIP_ASSIGN');
  }

  canBeginReview(status: string): boolean {
    return status === 'SUBMITTED' || status === 'NEEDS_CORRECTION';
  }

  canViewRestrictedDocs(): boolean {
    return this.auth.hasPermission('DOCUMENT_VIEW_RESTRICTED');
  }

  isRestrictedBlocked(item: ApplicationDocumentItem): boolean {
    return item.document.restrictedAccess && !this.canViewRestrictedDocs();
  }

  ngOnInit(): void {
    this.crumbs.set([
      { labelKey: 'nav.section.operations', labelFallback: 'Operations' },
      { labelKey: 'nav.applications', labelFallback: 'Applications', url: '/applications' },
      { labelKey: 'dossier.title', labelFallback: 'Dossier' },
    ]);
    this.load();
  }

  load(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      void this.router.navigate(['/applications']);
      return;
    }
    this.loading.set(true);
    this.error.set(false);
    this.errorMessage.set('');
    this.service.loadDossier(id).subscribe({
      next: (bundle) => {
        this.bundle.set(bundle);
        this.cinRevealed.set(false);
        this.loading.set(false);
      },
      error: (e: unknown) => {
        this.error.set(true);
        this.errorMessage.set(extractMessage(e));
        this.loading.set(false);
      },
    });
  }

  beginReview(): void {
    this.confirmBegin.set(true);
  }

  doBeginReview(): void {
    const id = this.bundle()?.application.id;
    if (!id) return;
    this.busy.set(true);
    this.service.beginReview(id).subscribe({
      next: () => {
        this.confirmBegin.set(false);
        this.busy.set(false);
        this.toast.show('success', this.i18n.t('dossier.actionDone'));
        this.load();
      },
      error: (e: unknown) => {
        this.confirmBegin.set(false);
        this.busy.set(false);
        this.toast.show('error', actionErrorMessage(e, this.i18n));
      },
    });
  }

  openReason(kind: ReasonKind): void {
    this.verifyTarget = null;
    this.reasonKind.set(kind);
    this.reasonText = '';
    this.reasonError.set('');
  }

  openVerify(item: ApplicationDocumentItem, status: 'VERIFIED' | 'REQUIRES_CORRECTION'): void {
    this.verifyTarget = item;
    this.verifyStatus = status;
    this.reasonKind.set('verify');
    this.reasonText = '';
    this.reasonError.set('');
  }

  closeReason(): void {
    this.reasonKind.set(null);
    this.reasonText = '';
    this.reasonError.set('');
    this.verifyTarget = null;
  }

  reasonTitle(): string {
    switch (this.reasonKind()) {
      case 'reject':
        return this.i18n.t('dossier.reject');
      case 'correct':
        return this.i18n.t('dossier.requestCorrection');
      case 'verify':
        return this.verifyStatus === 'VERIFIED'
          ? this.i18n.t('dossier.verify')
          : this.i18n.t('dossier.requestCorrection');
      default:
        return this.i18n.t('dossier.accept');
    }
  }

  reasonHint(): string {
    if (this.reasonKind() === 'verify') return this.i18n.t('dossier.verifyHint');
    if (this.reasonKind() === 'accept-note') return this.i18n.t('dossier.acceptHint');
    return this.i18n.t('dossier.reasonHint');
  }

  submitReason(): void {
    const kind = this.reasonKind();
    const id = this.bundle()?.application.id;
    if (!kind || !id) return;
    const text = this.reasonText.trim();
    // Accept note is optional; every other reason is mandatory and meaningful.
    if (kind !== 'accept-note' && kind !== 'verify') {
      if (text.length < 10) {
        this.reasonError.set(this.i18n.t('dossier.reasonTooShort'));
        return;
      }
    }
    if (kind === 'verify' && this.verifyStatus === 'REQUIRES_CORRECTION' && text.length < 10) {
      this.reasonError.set(this.i18n.t('dossier.reasonTooShort'));
      return;
    }
    this.busy.set(true);
    const done = () => {
      this.busy.set(false);
      this.closeReason();
      this.toast.show('success', this.i18n.t('dossier.actionDone'));
      this.load();
    };
    const fail = (e: unknown) => {
      this.busy.set(false);
      this.toast.show('error', actionErrorMessage(e, this.i18n));
    };
    if (kind === 'reject') this.service.reject(id, text).subscribe({ next: done, error: fail });
    else if (kind === 'correct')
      this.service.requestCorrection(id, text).subscribe({ next: done, error: fail });
    else if (kind === 'accept-note')
      this.service.accept(id, text || undefined).subscribe({ next: done, error: fail });
    else if (this.verifyTarget)
      this.service
        .verifyDocument(id, this.verifyTarget.id, {
          status: this.verifyStatus,
          ...(text ? { comment: text } : {}),
        })
        .subscribe({ next: done, error: fail });
  }

  download(item: ApplicationDocumentItem, _preview: boolean): void {
    if (this.isRestrictedBlocked(item)) {
      this.restrictedBlockedNote.set(true);
      return;
    }
    this.service.downloadDocument(item.document.id, item.document.restrictedAccess).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = item.document.originalFileName || `${item.document.reference}.pdf`;
        anchor.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      },
      error: (e: unknown) => {
        if (isForbidden(e)) {
          this.restrictedBlockedNote.set(true);
          this.toast.show('error', this.i18n.t('dossier.restrictedBlocked'));
        } else {
          this.toast.show('error', actionErrorMessage(e, this.i18n));
        }
      },
    });
  }

  statusTone(status: string): BadgeTone {
    switch (status) {
      case 'ACCEPTED':
        return 'success';
      case 'REJECTED':
      case 'WITHDRAWN':
        return 'error';
      case 'NEEDS_CORRECTION':
      case 'DRAFT':
        return 'warning';
      default:
        return 'info';
    }
  }

  decisionTone(decision: string): BadgeTone {
    switch (decision) {
      case 'APPROVED':
        return 'success';
      case 'REJECTED':
        return 'error';
      case 'NEEDS_CORRECTION':
      case 'RETURNED':
        return 'warning';
      default:
        return 'neutral';
    }
  }

  verifyTone(status: string): BadgeTone {
    switch (status) {
      case 'VERIFIED':
        return 'success';
      case 'REJECTED':
        return 'error';
      case 'REQUIRES_CORRECTION':
        return 'warning';
      default:
        return 'neutral';
    }
  }

  formatSize(bytes: number): string {
    if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
    if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${bytes} B`;
  }

  formatDateTime(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return date.toLocaleString(this.i18n.locale());
  }
}

function extractMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const status = (error as { status?: number }).status;
    if (status === 403) return '';
    const envelope = (error as { error?: { message?: string } }).error;
    if (envelope?.message) return envelope.message;
  }
  return '';
}

function isForbidden(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { status?: number }).status === 403
  );
}

function actionErrorMessage(error: unknown, i18n: I18nService): string {
  if (isForbidden(error)) return i18n.t('common.forbidden.body');
  const message = extractMessage(error);
  return message || i18n.t('common.error.body');
}
