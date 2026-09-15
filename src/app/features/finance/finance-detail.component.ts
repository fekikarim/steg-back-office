import { Component, inject, signal, OnInit, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { I18nService } from '../../core/i18n.service';
import { BreadcrumbService } from '../../core/breadcrumb.service';
import { AuthService } from '../../core/auth.service';
import { RealtimeService } from '../../core/realtime.service';
import { ToastService } from '../../shared/ui/toast.service';
import { FinanceService, type FinanceCaseBundle, isForbidden } from './finance.service';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { LiveStatusComponent } from '../../shared/ui/live-status.component';
import { BadgeComponent, type BadgeTone } from '../../shared/ui/badge.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { EmptyStateComponent, ErrorStateComponent } from '../../shared/ui/states.component';
import { AlertComponent } from '../../shared/ui/alert.component';
import { TabsComponent } from '../../shared/ui/tabs.component';
import { DialogComponent, ConfirmDialogComponent } from '../../shared/ui/dialog.component';
import { StIconComponent } from '../../shared/ui/icon.component';
import type { FinanceDossierDoc, FinanceCaseBundle as Bundle } from './finance.service';
import type { AiAnalysisResult, DocumentVerificationStatus } from '../../core/api-models';

type ReasonKind = 'approve' | 'reject' | 'doc-review' | null;

/**
 * Finance case detail (FINANCE/ADMIN view, DIRECTOR read-only).
 * The payment snapshot is rendered verbatim — no formula lives here.
 * Actual internship duration and eligible paid duration are shown as two
 * distinct blocks. Approve/reject are deliberate human FINANCE actions;
 * AI output is advisory only and can never decide.
 */
@Component({
  selector: 'st-finance-detail',
  standalone: true,
  imports: [
    RouterLink,
    FormsModule,
    PageHeaderComponent,
    LiveStatusComponent,
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
        <a routerLink="/finance" class="st-btn st-btn--secondary">{{ i18n.t('common.back') }}</a>
      </p>
    } @else if (bundle(); as dossier) {
      <st-page-header [title]="dossier.financeCase.reference" [subtitle]="internName(dossier)">
        <st-live-status />
        <a routerLink="/finance" class="st-btn st-btn--secondary">{{ i18n.t('common.back') }}</a>
        @if (canDecide() && isDecidable(dossier.financeCase.status)) {
          <button
            type="button"
            class="st-btn st-btn--primary"
            (click)="openReason('approve')"
            [disabled]="busy()"
          >
            {{ i18n.t('finance.approve') }}
          </button>
          <button
            type="button"
            class="st-btn st-btn--danger"
            (click)="openReason('reject')"
            [disabled]="busy()"
          >
            {{ i18n.t('finance.reject') }}
          </button>
        }
      </st-page-header>

      <p class="st-flags">
        <st-badge
          [label]="dossier.financeCase.status"
          [tone]="statusTone(dossier.financeCase.status)"
        />
        @if (isDecidable(dossier.financeCase.status)) {
          <st-badge [label]="i18n.t('finance.awaitingDecision')" tone="warning" icon="alert" />
        }
      </p>

      <st-tabs
        [tabs]="tabs(dossier)"
        [activeId]="tab()"
        label="Finance case"
        (select)="tab.set($event)"
      />

      @if (tab() === 'overview') {
        <div class="st-grid">
          <section class="st-card" [attr.aria-label]="i18n.t('finance.actualTitle')">
            <h2 class="st-card__title">{{ i18n.t('finance.actualTitle') }}</h2>
            @if (dossier.internship; as internship) {
              <dl class="st-defs">
                <div>
                  <dt>{{ i18n.t('finance.internship') }}</dt>
                  <dd>
                    <a [routerLink]="['/internships', internship.id]" dir="ltr">
                      {{ dossier.financeCase.internshipReference }}
                    </a>
                  </dd>
                </div>
                <div>
                  <dt>{{ i18n.t('finance.candidate') }}</dt>
                  <dd dir="auto">{{ internship.candidateFullName }}</dd>
                </div>
                <div>
                  <dt>{{ i18n.t('finance.actualPeriod') }}</dt>
                  <dd dir="ltr">{{ internship.startDate }} → {{ internship.endDate }}</dd>
                </div>
                <div>
                  <dt>{{ i18n.t('finance.internshipType') }}</dt>
                  <dd>{{ internship.type }}</dd>
                </div>
                <div>
                  <dt>{{ i18n.t('finance.requirement') }}</dt>
                  <dd>
                    <st-badge
                      [label]="internship.requirement"
                      [tone]="internship.requirement === 'OBLIGATOIRE' ? 'success' : 'warning'"
                    />
                  </dd>
                </div>
                <div>
                  <dt>{{ i18n.t('finance.department') }}</dt>
                  <dd dir="auto">{{ dossier.assignment?.departmentName || '—' }}</dd>
                </div>
              </dl>
            } @else {
              <st-alert tone="warning">{{ i18n.t('finance.internshipUnavailable') }}</st-alert>
            }
            <p class="st-hint">{{ i18n.t('finance.actualHint') }}</p>
          </section>

          <section class="st-card st-card--calc" [attr.aria-label]="i18n.t('finance.calcTitle')">
            <h2 class="st-card__title">{{ i18n.t('finance.calcTitle') }}</h2>
            @if (dossier.financeCase.calculation; as calc) {
              <dl class="st-defs st-defs--calc">
                <div>
                  <dt>{{ i18n.t('finance.completedMonths') }}</dt>
                  <dd>{{ calc.completedMonths }}</dd>
                </div>
                <div>
                  <dt>{{ i18n.t('finance.payableMonths') }}</dt>
                  <dd>{{ calc.payableMonths }}</dd>
                </div>
                <div>
                  <dt>{{ i18n.t('finance.ratePerMonth') }}</dt>
                  <dd dir="ltr">{{ calc.ratePerMonth }} {{ calc.currencyCode }}</dd>
                </div>
                <div>
                  <dt>{{ i18n.t('finance.calculatedAmount') }}</dt>
                  <dd dir="ltr">{{ calc.calculatedAmount }} {{ calc.currencyCode }}</dd>
                </div>
                <div class="st-capped">
                  <dt>{{ i18n.t('finance.cappedAmount') }}</dt>
                  <dd dir="ltr">
                    <strong>{{ calc.cappedAmount }} {{ calc.currencyCode }}</strong>
                    @if (calc.capApplied) {
                      <st-badge [label]="i18n.t('finance.capApplied')" tone="warning" />
                    }
                  </dd>
                </div>
                <div>
                  <dt>{{ i18n.t('finance.calculatedAt') }}</dt>
                  <dd dir="ltr">{{ calc.calculatedAt.slice(0, 16).replace('T', ' ') }}</dd>
                </div>
              </dl>
              <p class="st-hint">{{ i18n.t('finance.verbatimHint') }}</p>
            } @else {
              <st-empty-state
                [title]="i18n.t('common.empty.title')"
                [body]="i18n.t('finance.noCalculation')"
              />
            }
            @if (canReviewDocs() && isDecidable(dossier.financeCase.status)) {
              <button
                type="button"
                class="st-btn st-btn--secondary"
                (click)="recalculate()"
                [disabled]="busy()"
              >
                <st-icon name="refresh" [size]="14" /> {{ i18n.t('finance.recalculate') }}
              </button>
              <p class="st-hint">{{ i18n.t('finance.recalculateHint') }}</p>
            }
          </section>
        </div>

        <section class="st-card" [attr.aria-label]="i18n.t('finance.receiptTitle')">
          <h2 class="st-card__title">{{ i18n.t('finance.receiptTitle') }}</h2>
          @if (dossier.financeCase.receiptReference) {
            <p class="st-hint" dir="ltr">{{ dossier.financeCase.receiptReference }}</p>
            <button
              type="button"
              class="st-btn st-btn--secondary"
              (click)="downloadReceipt()"
              [disabled]="busy()"
            >
              <st-icon name="download" [size]="14" /> {{ i18n.t('common.download') }}
            </button>
          } @else {
            <p class="st-hint">{{ i18n.t('finance.noReceipt') }}</p>
          }
        </section>
      }

      @if (tab() === 'dossier') {
        <section class="st-card" [attr.aria-label]="i18n.t('finance.dossierTitle')">
          <h2 class="st-card__title">{{ i18n.t('finance.dossierTitle') }}</h2>
          <p class="st-hint">{{ i18n.t('finance.dossierHint') }}</p>
          @if (dossier.docs.length === 0) {
            <st-empty-state
              [title]="i18n.t('common.empty.title')"
              [body]="i18n.t('finance.noDocs')"
            />
          } @else {
            <ul class="st-docs">
              @for (item of dossier.docs; track item.documentId) {
                <li class="st-docrow" [class.st-docrow--restricted]="isRestricted(item)">
                  <div class="st-docrow__meta">
                    <strong dir="auto">{{
                      item.meta?.originalFileName || item.documentReference
                    }}</strong>
                    <span class="st-docrow__sub" dir="auto">
                      {{ item.documentType }} · {{ item.documentReference }}
                    </span>
                    <span class="st-docrow__badges">
                      @if (item.mandatory) {
                        <st-badge [label]="i18n.t('dossier.mandatory')" tone="info" />
                      }
                      <st-badge
                        [label]="item.verificationStatus"
                        [tone]="verifyTone(item.verificationStatus)"
                      />
                      @if (isRestricted(item)) {
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
                    @if (item.reviewedByName) {
                      <span class="st-docrow__sub" dir="auto">
                        {{ item.reviewedByName }} ·
                        {{ (item.reviewedAt || '').slice(0, 16).replace('T', ' ') }}
                      </span>
                    }
                  </div>
                  <div class="st-docrow__actions">
                    <button
                      type="button"
                      class="st-btn st-btn--secondary"
                      [disabled]="isRestrictedBlocked(item) || busyDoc() === item.documentId"
                      (click)="openDoc(item)"
                    >
                      <st-icon name="download" [size]="14" /> {{ i18n.t('common.download') }}
                    </button>
                    @if (canReviewDocs() && isDecidable(dossier.financeCase.status)) {
                      <button
                        type="button"
                        class="st-btn st-btn--secondary"
                        (click)="openDocReview(item, 'VERIFIED')"
                        [disabled]="busy()"
                      >
                        {{ i18n.t('finance.markVerified') }}
                      </button>
                      <button
                        type="button"
                        class="st-btn st-btn--secondary"
                        (click)="openDocReview(item, 'REQUIRES_CORRECTION')"
                        [disabled]="busy()"
                      >
                        {{ i18n.t('finance.requestCorrection') }}
                      </button>
                    }
                  </div>
                </li>
              }
            </ul>
          }
          @if (docForbiddenNote()) {
            <st-alert tone="warning">{{ i18n.t('finance.restrictedBlocked') }}</st-alert>
          }
        </section>
      }

      @if (tab() === 'history') {
        <section class="st-card" [attr.aria-label]="i18n.t('finance.historyTitle')">
          <h2 class="st-card__title">{{ i18n.t('finance.historyTitle') }}</h2>
          <dl class="st-defs">
            <div>
              <dt>{{ i18n.t('finance.openedAt') }}</dt>
              <dd dir="ltr">{{ dossier.financeCase.openedAt.slice(0, 16).replace('T', ' ') }}</dd>
            </div>
            @if (dossier.financeCase.closedAt) {
              <div>
                <dt>{{ i18n.t('finance.closedAt') }}</dt>
                <dd dir="ltr">{{ dossier.financeCase.closedAt.slice(0, 16).replace('T', ' ') }}</dd>
              </div>
            }
          </dl>
          @if (dossier.financeCase.approvals.length === 0) {
            <st-empty-state
              [title]="i18n.t('common.empty.title')"
              [body]="i18n.t('finance.noApprovals')"
            />
          } @else {
            <ol class="st-timeline">
              @for (a of dossier.financeCase.approvals; track a.id) {
                <li class="st-timeline__item">
                  <span class="st-timeline__seq" aria-hidden="true">{{ a.decisionSequence }}</span>
                  <div>
                    <p class="st-timeline__head" dir="auto">
                      <st-badge [label]="a.decision" [tone]="decisionTone(a.decision)" />
                    </p>
                    <p class="st-timeline__meta" dir="auto">
                      {{ a.decidedByName }} · {{ a.decidedAt.slice(0, 16).replace('T', ' ') }}
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

      @if (tab() === 'ai') {
        <section class="st-card" [attr.aria-label]="i18n.t('finance.aiTitle')">
          <h2 class="st-card__title">{{ i18n.t('finance.aiTitle') }}</h2>
          <st-alert tone="info" [title]="i18n.t('finance.aiAdvisoryTitle')">
            {{ i18n.t('finance.aiAdvisoryBody') }}
          </st-alert>
          @if (canAnalyze()) {
            <button
              type="button"
              class="st-btn st-btn--secondary"
              (click)="runAnalysis()"
              [disabled]="aiBusy()"
            >
              <st-icon name="sparkles" [size]="14" /> {{ i18n.t('finance.runAnalysis') }}
            </button>
          }
          @if (aiError()) {
            <st-alert tone="error">{{ aiError() }}</st-alert>
          }
          @if (aiResult(); as result) {
            <dl class="st-defs">
              <div>
                <dt>{{ i18n.t('finance.aiModel') }}</dt>
                <dd dir="auto">{{ result.analysis.modelUsed }}</dd>
              </div>
              <div>
                <dt>{{ i18n.t('finance.aiCin') }}</dt>
                <dd>
                  <st-badge
                    [label]="
                      result.analysis.cinExcluded
                        ? i18n.t('finance.aiCinExcluded')
                        : i18n.t('finance.aiCinUnknown')
                    "
                    [tone]="result.analysis.cinExcluded ? 'success' : 'warning'"
                  />
                </dd>
              </div>
            </dl>
            @if (result.responseText) {
              <p class="st-ai-text" dir="auto">{{ result.responseText }}</p>
            }
            @if (result.recommendations.length === 0) {
              <p class="st-hint">{{ i18n.t('finance.aiNoRecommendations') }}</p>
            } @else {
              <ul class="st-recs">
                @for (rec of result.recommendations; track rec.id) {
                  <li class="st-rec">
                    <p dir="auto">{{ rec.recommendationText }}</p>
                    <span class="st-rec__foot">
                      <st-badge
                        [label]="rec.status"
                        [tone]="rec.status === 'PROPOSED' ? 'info' : 'neutral'"
                      />
                      @if (rec.status === 'PROPOSED' && canAnalyze()) {
                        <button
                          type="button"
                          class="st-btn st-btn--text"
                          (click)="reviewRec(rec.id, 'DISMISSED')"
                          [disabled]="aiBusy()"
                        >
                          {{ i18n.t('finance.dismissRec') }}
                        </button>
                        <button
                          type="button"
                          class="st-btn st-btn--text"
                          (click)="reviewRec(rec.id, 'ACCEPTED_BY_HUMAN')"
                          [disabled]="aiBusy()"
                        >
                          {{ i18n.t('finance.markReviewedRec') }}
                        </button>
                      }
                    </span>
                  </li>
                }
              </ul>
            }
          }
        </section>
      }

      <!-- Approve / reject reason dialog -->
      <st-dialog [open]="reasonKind() !== null" [title]="reasonTitle()" (close)="closeReason()">
        @if (reasonKind() === 'approve') {
          <p class="st-hint">{{ i18n.t('finance.approveHint') }}</p>
        } @else {
          <p class="st-hint">{{ i18n.t('finance.rejectHint') }}</p>
        }
        <label class="st-field">
          <span class="st-field__label">
            {{ i18n.t('finance.commentLabel') }}{{ reasonKind() === 'reject' ? ' *' : '' }}
          </span>
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
        [open]="confirmApprove()"
        [title]="i18n.t('finance.approve')"
        [body]="i18n.t('finance.approveBody')"
        [consequence]="i18n.t('finance.approveConsequence')"
        [confirmLabel]="i18n.t('common.confirm')"
        [cancelLabel]="i18n.t('common.cancel')"
        [busy]="busy()"
        (confirmed)="doApprove()"
        (cancel)="confirmApprove.set(false)"
      />

      <!-- Document review dialog -->
      <st-dialog
        [open]="docReview() !== null"
        [title]="i18n.t('finance.reviewDocTitle')"
        (close)="closeDocReview()"
      >
        <p class="st-hint">{{ i18n.t('finance.reviewDocHint') }}</p>
        <label class="st-field">
          <span class="st-field__label">
            {{ i18n.t('finance.commentLabel') }}{{ docReviewStatus !== 'VERIFIED' ? ' *' : '' }}
          </span>
          <textarea class="st-input" rows="3" [(ngModel)]="docComment" dir="auto"></textarea>
          @if (docReviewError()) {
            <span class="st-field__error" role="alert">{{ docReviewError() }}</span>
          }
        </label>
        <div slot="footer" class="st-dialog__actions">
          <button type="button" class="st-btn st-btn--secondary" (click)="closeDocReview()">
            {{ i18n.t('common.cancel') }}
          </button>
          <button
            type="button"
            class="st-btn st-btn--primary"
            [disabled]="busy()"
            (click)="submitDocReview()"
          >
            {{ i18n.t('common.confirm') }}
          </button>
        </div>
      </st-dialog>
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
      .st-card--calc {
        border-inline-start: 3px solid var(--action-primary);
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
        grid-template-columns: 11rem 1fr;
        gap: 0.5rem;
        font-size: 0.84rem;
      }
      .st-defs dt {
        color: var(--text-muted);
      }
      .st-defs dd {
        margin: 0;
        overflow-wrap: anywhere;
        font-variant-numeric: tabular-nums;
      }
      .st-capped dd {
        display: flex;
        gap: 0.5rem;
        align-items: center;
        flex-wrap: wrap;
      }
      .st-hint {
        font-size: 0.78rem;
        color: var(--text-secondary);
      }
      .st-docs {
        list-style: none;
        margin: 0.4rem 0 0;
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
      .st-docrow--restricted {
        border-color: color-mix(in srgb, var(--action-danger) 45%, transparent);
      }
      .st-docrow__meta {
        display: grid;
        gap: 0.25rem;
        flex: 1;
        min-inline-size: 14rem;
        font-size: 0.85rem;
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
      .st-ai-text {
        font-size: 0.85rem;
        background: var(--bg-page);
        border-radius: 0.5rem;
        padding: 0.6rem 0.75rem;
        overflow-wrap: anywhere;
      }
      .st-recs {
        list-style: none;
        margin: 0.6rem 0 0;
        padding: 0;
        display: grid;
        gap: 0.6rem;
      }
      .st-rec {
        border: 1px dashed var(--border-default);
        border-radius: 0.6rem;
        padding: 0.7rem 0.8rem;
        font-size: 0.85rem;
        display: grid;
        gap: 0.4rem;
      }
      .st-rec p {
        margin: 0;
      }
      .st-rec__foot {
        display: flex;
        gap: 0.4rem;
        align-items: center;
        flex-wrap: wrap;
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
export class FinanceDetailComponent implements OnInit {
  readonly i18n = inject(I18nService);
  readonly auth = inject(AuthService);
  private readonly crumbs = inject(BreadcrumbService);
  private readonly service = inject(FinanceService);
  private readonly realtime = inject(RealtimeService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal(false);
  readonly errorMessage = signal('');
  readonly bundle = signal<FinanceCaseBundle | null>(null);
  readonly tab = signal('overview');

  readonly reasonKind = signal<ReasonKind>(null);
  readonly confirmApprove = signal(false);
  reasonText = '';
  readonly reasonError = signal('');

  readonly docReview = signal<FinanceDossierDoc | null>(null);
  docReviewStatus: DocumentVerificationStatus = 'VERIFIED';
  docComment = '';
  readonly docReviewError = signal('');
  readonly docForbiddenNote = signal(false);
  readonly busyDoc = signal<string | null>(null);

  readonly aiBusy = signal(false);
  readonly aiError = signal('');
  readonly aiResult = signal<AiAnalysisResult | null>(null);

  tabs(bundle: Bundle): { id: string; label: string; count?: number }[] {
    return [
      { id: 'overview', label: this.i18n.t('finance.tabOverview') },
      {
        id: 'dossier',
        label: this.i18n.t('finance.tabDossier'),
        count: bundle.docs.length,
      },
      { id: 'history', label: this.i18n.t('finance.tabHistory') },
      { id: 'ai', label: this.i18n.t('finance.tabAi') },
    ];
  }

  internName(dossier: Bundle): string {
    return dossier.internship?.candidateFullName ?? dossier.financeCase.internshipReference;
  }

  /** FINANCE role only — backend enforces hasRole('FINANCE') on approve/reject. */
  canDecide(): boolean {
    return this.auth.role() === 'FINANCE';
  }

  canReviewDocs(): boolean {
    return this.auth.hasPermission('FINANCE_CASE_VIEW');
  }

  canAnalyze(): boolean {
    const role = this.auth.role();
    return role === 'FINANCE' || role === 'ADMIN';
  }

  canViewRestrictedDocs(): boolean {
    return this.auth.hasPermission('DOCUMENT_VIEW_RESTRICTED');
  }

  isDecidable(status: string): boolean {
    return ['OPENED', 'UNDER_REVIEW', 'DOCUMENTS_MISSING', 'READY_FOR_DECISION'].includes(status);
  }

  isRestricted(item: FinanceDossierDoc): boolean {
    return item.documentType === 'CIN_COPY' || (item.meta?.restrictedAccess ?? false);
  }

  isRestrictedBlocked(item: FinanceDossierDoc): boolean {
    return this.isRestricted(item) && !this.canViewRestrictedDocs();
  }

  ngOnInit(): void {
    this.crumbs.set([
      { labelKey: 'nav.finance', labelFallback: 'Finance', url: '/finance' },
      { labelKey: 'finance.caseTitle', labelFallback: 'Case' },
    ]);
    this.load();
    this.realtime.financeUpdates$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((e) => {
      const currentId = this.route.snapshot.paramMap.get('id');
      if (!e.entityId || e.entityId === currentId) this.load();
    });
  }

  load(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      void this.router.navigate(['/finance']);
      return;
    }
    this.loading.set(true);
    this.error.set(false);
    this.errorMessage.set('');
    this.service.loadCase(id).subscribe({
      next: (bundle) => {
        this.bundle.set(bundle);
        this.loading.set(false);
      },
      error: (e: unknown) => {
        this.error.set(true);
        this.errorMessage.set(extractMessage(e));
        this.loading.set(false);
      },
    });
  }

  recalculate(): void {
    const id = this.bundle()?.financeCase.id;
    if (!id) return;
    this.busy.set(true);
    this.service.recalculate(id).subscribe({
      next: () => {
        this.busy.set(false);
        this.toast.show('success', this.i18n.t('finance.recalculated'));
        this.load();
      },
      error: (e: unknown) => {
        this.busy.set(false);
        this.toast.show('error', actionErrorMessage(e, this.i18n));
      },
    });
  }

  openReason(kind: 'approve' | 'reject'): void {
    this.reasonKind.set(kind);
    this.reasonText = '';
    this.reasonError.set('');
  }

  closeReason(): void {
    this.reasonKind.set(null);
    this.reasonText = '';
    this.reasonError.set('');
  }

  reasonTitle(): string {
    return this.reasonKind() === 'reject'
      ? this.i18n.t('finance.reject')
      : this.i18n.t('finance.approve');
  }

  /** Approve goes through an explicit receipt-consequence confirmation. */
  submitReason(): void {
    const kind = this.reasonKind();
    if (!kind) return;
    const text = this.reasonText.trim();
    if (kind === 'reject' && text.length < 10) {
      this.reasonError.set(this.i18n.t('finance.reasonTooShort'));
      return;
    }
    if (kind === 'approve') {
      this.closeReason();
      this.confirmApprove.set(true);
      return;
    }
    this.doReject(text);
  }

  doApprove(): void {
    const id = this.bundle()?.financeCase.id;
    if (!id) return;
    this.busy.set(true);
    this.service.approve(id, this.reasonText.trim() || undefined).subscribe({
      next: () => {
        this.busy.set(false);
        this.confirmApprove.set(false);
        this.toast.show('success', this.i18n.t('finance.approved'));
        this.load();
      },
      error: (e: unknown) => {
        this.busy.set(false);
        this.confirmApprove.set(false);
        this.toast.show('error', actionErrorMessage(e, this.i18n));
      },
    });
  }

  private doReject(reason: string): void {
    const id = this.bundle()?.financeCase.id;
    if (!id) return;
    this.busy.set(true);
    this.service.reject(id, reason).subscribe({
      next: () => {
        this.busy.set(false);
        this.closeReason();
        this.toast.show('success', this.i18n.t('finance.rejected'));
        this.load();
      },
      error: (e: unknown) => {
        this.busy.set(false);
        this.toast.show('error', actionErrorMessage(e, this.i18n));
      },
    });
  }

  downloadReceipt(): void {
    const c = this.bundle()?.financeCase;
    if (!c) return;
    this.busy.set(true);
    this.service.downloadReceipt(c.id).subscribe({
      next: (blob) => {
        this.busy.set(false);
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `${c.receiptReference ?? c.reference}-receipt.pdf`;
        anchor.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      },
      error: (e: unknown) => {
        this.busy.set(false);
        this.toast.show('error', actionErrorMessage(e, this.i18n));
      },
    });
  }

  openDoc(item: FinanceDossierDoc): void {
    if (this.isRestrictedBlocked(item)) {
      this.docForbiddenNote.set(true);
      return;
    }
    this.busyDoc.set(item.documentId);
    this.service.downloadDocument(item.documentId, this.isRestricted(item)).subscribe({
      next: (blob) => {
        this.busyDoc.set(null);
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = item.meta?.originalFileName || `${item.documentReference}.pdf`;
        anchor.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      },
      error: (e: unknown) => {
        this.busyDoc.set(null);
        if (isForbidden(e)) {
          this.docForbiddenNote.set(true);
          this.toast.show('error', this.i18n.t('finance.restrictedBlocked'));
        } else {
          this.toast.show('error', actionErrorMessage(e, this.i18n));
        }
      },
    });
  }

  openDocReview(item: FinanceDossierDoc, status: DocumentVerificationStatus): void {
    this.docReview.set(item);
    this.docReviewStatus = status;
    this.docComment = '';
    this.docReviewError.set('');
  }

  closeDocReview(): void {
    this.docReview.set(null);
    this.docComment = '';
    this.docReviewError.set('');
  }

  submitDocReview(): void {
    const target = this.docReview();
    const caseId = this.bundle()?.financeCase.id;
    if (!target || !caseId) return;
    const comment = this.docComment.trim();
    if (this.docReviewStatus !== 'VERIFIED' && comment.length < 10) {
      this.docReviewError.set(this.i18n.t('finance.reasonTooShort'));
      return;
    }
    this.busy.set(true);
    this.service
      .reviewDocument(caseId, target.documentId, {
        status: this.docReviewStatus,
        ...(comment ? { comment } : {}),
      })
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.closeDocReview();
          this.toast.show('success', this.i18n.t('finance.docReviewed'));
          this.load();
        },
        error: (e: unknown) => {
          this.busy.set(false);
          this.toast.show('error', actionErrorMessage(e, this.i18n));
        },
      });
  }

  runAnalysis(): void {
    const id = this.bundle()?.financeCase.id;
    if (!id) return;
    this.aiBusy.set(true);
    this.aiError.set('');
    this.service.analyze(id).subscribe({
      next: (result) => {
        this.aiBusy.set(false);
        this.aiResult.set(result);
      },
      error: (e: unknown) => {
        this.aiBusy.set(false);
        this.aiError.set(actionErrorMessage(e, this.i18n));
      },
    });
  }

  /** Traceability-only review of a recommendation — never a payment decision. */
  reviewRec(recommendationId: string, status: 'ACCEPTED_BY_HUMAN' | 'DISMISSED'): void {
    this.aiBusy.set(true);
    this.service.reviewRecommendation(recommendationId, status).subscribe({
      next: (updated) => {
        this.aiBusy.set(false);
        const current = this.aiResult();
        if (current) {
          this.aiResult.set({
            ...current,
            recommendations: current.recommendations.map((r) =>
              r.id === updated.id ? updated : r,
            ),
          });
        }
      },
      error: (e: unknown) => {
        this.aiBusy.set(false);
        this.aiError.set(actionErrorMessage(e, this.i18n));
      },
    });
  }

  statusTone(status: string): BadgeTone {
    switch (status) {
      case 'APPROVED':
        return 'success';
      case 'REJECTED':
      case 'CLOSED':
        return 'error';
      case 'READY_FOR_DECISION':
        return 'info';
      case 'DOCUMENTS_MISSING':
        return 'warning';
      default:
        return 'neutral';
    }
  }

  decisionTone(decision: string): BadgeTone {
    switch (decision) {
      case 'APPROVED':
        return 'success';
      case 'REJECTED':
        return 'error';
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

function actionErrorMessage(error: unknown, i18n: I18nService): string {
  if (isForbidden(error)) return i18n.t('common.forbidden.body');
  const message = extractMessage(error);
  return message || i18n.t('common.error.body');
}
