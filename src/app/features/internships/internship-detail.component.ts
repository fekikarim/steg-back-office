import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { I18nService } from '../../core/i18n.service';
import { BreadcrumbService } from '../../core/breadcrumb.service';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../shared/ui/toast.service';
import {
  InternshipService,
  InternshipBundle,
  activeAssignment,
  isForbidden,
} from './internship.service';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { BadgeComponent, type BadgeTone } from '../../shared/ui/badge.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { EmptyStateComponent, ErrorStateComponent } from '../../shared/ui/states.component';
import { AlertComponent } from '../../shared/ui/alert.component';
import { TabsComponent } from '../../shared/ui/tabs.component';
import { DialogComponent, ConfirmDialogComponent } from '../../shared/ui/dialog.component';
import { StIconComponent } from '../../shared/ui/icon.component';
import type {
  Department,
  Employee,
  InternshipAssignment,
  InternshipDocumentItem,
  DocumentType,
  CertificateInfo,
} from '../../core/api-models';
import { INTERNSHIP_UPLOAD_TYPES, REQUIRED_DOSSIER_TYPES } from '../../core/api-models';

/**
 * Internship detail: backend-computed classification shown read-only,
 * dates editor (backend reclassifies), assignment workspace with the
 * one-active-assignment rule, lifecycle timeline and certificate entry.
 * The client never computes type/requirement/eligibility.
 */
@Component({
  selector: 'st-internship-detail',
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
        <a routerLink="/internships" class="st-btn st-btn--secondary">{{
          i18n.t('common.back')
        }}</a>
      </p>
    } @else if (bundle(); as dossier) {
      <st-page-header
        [title]="dossier.internship.reference"
        [subtitle]="dossier.internship.candidateFullName"
      >
        <a routerLink="/internships" class="st-btn st-btn--secondary">{{
          i18n.t('common.back')
        }}</a>
        @if (canManage() && dossier.internship.status === 'PLANNED') {
          <button
            type="button"
            class="st-btn st-btn--primary"
            (click)="confirmAction.set('activate')"
            [disabled]="busy()"
          >
            {{ i18n.t('internshipDetail.activate') }}
          </button>
        }
        @if (canManage() && dossier.internship.status === 'ACTIVE') {
          <button
            type="button"
            class="st-btn st-btn--primary"
            (click)="confirmAction.set('complete')"
            [disabled]="busy()"
          >
            {{ i18n.t('internshipDetail.complete') }}
          </button>
        }
        @if (
          canManage() &&
          (dossier.internship.status === 'PLANNED' || dossier.internship.status === 'ACTIVE')
        ) {
          <button
            type="button"
            class="st-btn st-btn--danger"
            (click)="confirmAction.set('cancel')"
            [disabled]="busy()"
          >
            {{ i18n.t('internshipDetail.cancel') }}
          </button>
        }
      </st-page-header>

      <p class="st-flags">
        <st-badge
          [label]="dossier.internship.status"
          [tone]="statusTone(dossier.internship.status)"
        />
        <st-badge [label]="dossier.internship.type" tone="info" />
        <st-badge [label]="dossier.internship.requirement" tone="neutral" />
        <st-badge
          [label]="
            dossier.internship.paymentEligible
              ? i18n.t('internshipDetail.eligible')
              : i18n.t('internshipDetail.notEligible')
          "
          [tone]="dossier.internship.paymentEligible ? 'success' : 'neutral'"
        />
      </p>

      <st-tabs
        [tabs]="tabs()"
        [activeId]="tab()"
        label="Internship"
        (select)="tab.set($event)"
        class="st-no-print"
      />

      @if (tab() === 'overview') {
        <div class="st-grid">
          <section class="st-card" [attr.aria-label]="i18n.t('internshipDetail.internship')">
            <h2 class="st-card__title">{{ i18n.t('internshipDetail.internship') }}</h2>
            <dl class="st-defs">
              <div>
                <dt>{{ i18n.t('internshipDetail.period') }}</dt>
                <dd dir="ltr">
                  {{ dossier.internship.startDate }} → {{ dossier.internship.endDate }}
                </dd>
              </div>
              <div>
                <dt>{{ i18n.t('internshipDetail.subject') }}</dt>
                <dd dir="auto">{{ dossier.internship.subject }}</dd>
              </div>
              <div>
                <dt>{{ i18n.t('internshipDetail.academicLevel') }}</dt>
                <dd dir="auto">{{ dossier.internship.academicLevel || '—' }}</dd>
              </div>
              <div>
                <dt>{{ i18n.t('internshipDetail.candidate') }}</dt>
                <dd dir="auto">{{ dossier.internship.candidateFullName }}</dd>
              </div>
            </dl>
            @if (canManage()) {
              <p>
                <button type="button" class="st-btn st-btn--secondary" (click)="openDates()">
                  {{ i18n.t('internshipDetail.editDates') }}
                </button>
              </p>
            }
          </section>

          <section class="st-card" [attr.aria-label]="i18n.t('internshipDetail.classification')">
            <h2 class="st-card__title">{{ i18n.t('internshipDetail.classification') }}</h2>
            @if (dossier.classification; as c) {
              <dl class="st-defs">
                <div>
                  <dt>{{ i18n.t('internshipDetail.computedType') }}</dt>
                  <dd>{{ c.type }}</dd>
                </div>
                <div>
                  <dt>{{ i18n.t('internshipDetail.requirement') }}</dt>
                  <dd>{{ c.requirement }}</dd>
                </div>
                <div>
                  <dt>{{ i18n.t('internshipDetail.eligibility') }}</dt>
                  <dd>
                    {{
                      c.paymentEligible
                        ? i18n.t('internshipDetail.eligible')
                        : i18n.t('internshipDetail.notEligible')
                    }}
                  </dd>
                </div>
                <div>
                  <dt>{{ i18n.t('internshipDetail.duration') }}</dt>
                  <dd>{{ c.durationInDays }}</dd>
                </div>
              </dl>
              <p class="st-rule" dir="auto">{{ c.appliedRuleDescription }}</p>
            } @else {
              <st-alert tone="warning">{{
                i18n.t('internshipDetail.classificationUnavailable')
              }}</st-alert>
            }
            <p class="st-hint">{{ i18n.t('internshipDetail.backendDerivedHint') }}</p>
          </section>
        </div>

        <section class="st-card" [attr.aria-label]="i18n.t('internshipDetail.certificate')">
          <h2 class="st-card__title">{{ i18n.t('internshipDetail.certificate') }}</h2>
          @if (certificate(); as cert) {
            <p class="st-hint" dir="ltr">
              {{ cert.reference }} · {{ cert.status }} · {{ cert.generatedAt }}
            </p>
            <button
              type="button"
              class="st-btn st-btn--secondary"
              (click)="downloadCert(cert)"
              [disabled]="busy()"
            >
              <st-icon name="download" [size]="14" /> {{ i18n.t('common.download') }}
            </button>
          } @else if (canSeeCertificate(dossier.internship.status)) {
            <p class="st-hint">{{ i18n.t('internshipDetail.certificateHint') }}</p>
            <button
              type="button"
              class="st-btn st-btn--primary"
              (click)="confirmAction.set('certificate')"
              [disabled]="busy() || dossier.internship.status !== 'COMPLETED'"
            >
              {{ i18n.t('internshipDetail.generateCertificate') }}
            </button>
            @if (dossier.internship.status !== 'COMPLETED') {
              <p class="st-hint">{{ i18n.t('internshipDetail.certificateNotReady') }}</p>
            }
          } @else {
            <p class="st-hint">{{ i18n.t('internshipDetail.certificateNotReady') }}</p>
          }
        </section>
      }

      @if (tab() === 'assignment') {
        <section class="st-card" [attr.aria-label]="i18n.t('internshipDetail.assignment')">
          <div class="st-card__head">
            <h2 class="st-card__title">{{ i18n.t('internshipDetail.assignment') }}</h2>
            @if (canManage()) {
              <button type="button" class="st-btn st-btn--primary" (click)="openAssign()">
                {{
                  currentAssignment()
                    ? i18n.t('internshipDetail.reassign')
                    : i18n.t('internshipDetail.assign')
                }}
              </button>
            }
          </div>
          <st-alert tone="info">{{ i18n.t('internshipDetail.oneActiveRule') }}</st-alert>
          @if (currentAssignment(); as current) {
            <dl class="st-defs">
              <div>
                <dt>{{ i18n.t('internshipDetail.supervisor') }}</dt>
                <dd dir="auto">{{ current.supervisorName }}</dd>
              </div>
              <div>
                <dt>{{ i18n.t('internshipDetail.department') }}</dt>
                <dd dir="auto">{{ current.departmentName }}</dd>
              </div>
              <div>
                <dt>{{ i18n.t('internshipDetail.assignedBy') }}</dt>
                <dd dir="auto">{{ current.assignedByName }}</dd>
              </div>
              @if (current.assignmentReason) {
                <div>
                  <dt>{{ i18n.t('internshipDetail.reason') }}</dt>
                  <dd dir="auto">{{ current.assignmentReason }}</dd>
                </div>
              }
            </dl>
          } @else {
            <st-empty-state
              [title]="i18n.t('common.empty.title')"
              [body]="i18n.t('internshipDetail.noAssignment')"
            />
          }
          @if (dossier.assignments.length > 0) {
            <h3 class="st-sub">{{ i18n.t('internshipDetail.history') }}</h3>
            <div class="st-table-wrap">
              <table class="st-table">
                <thead>
                  <tr>
                    <th scope="col">{{ i18n.t('internshipDetail.supervisor') }}</th>
                    <th scope="col">{{ i18n.t('internshipDetail.department') }}</th>
                    <th scope="col">{{ i18n.t('table.status') }}</th>
                    <th scope="col">{{ i18n.t('internshipDetail.assignedAt') }}</th>
                  </tr>
                </thead>
                <tbody>
                  @for (a of dossier.assignments; track a.id) {
                    <tr>
                      <td dir="auto">{{ a.supervisorName }}</td>
                      <td dir="auto">{{ a.departmentName }}</td>
                      <td><st-badge [label]="a.status" [tone]="assignmentTone(a.status)" /></td>
                      <td dir="ltr">{{ a.assignedAt.slice(0, 10) }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </section>
      }

      @if (tab() === 'documents') {
        <section class="st-card" [attr.aria-label]="i18n.t('internshipDocs.checklistTitle')">
          <div class="st-card__head">
            <h2 class="st-card__title">{{ i18n.t('internshipDocs.checklistTitle') }}</h2>
            <button
              type="button"
              class="st-btn st-btn--secondary st-no-print"
              (click)="printSummary()"
            >
              <st-icon name="print" [size]="14" /> {{ i18n.t('internshipDocs.print') }}
            </button>
          </div>
          <p class="st-hint">{{ i18n.t('internshipDocs.checklistHint') }}</p>
          <ul class="st-checks">
            @for (item of checklist(dossier); track item.key) {
              <li class="st-check">
                <st-badge
                  [label]="item.met ? i18n.t('common.yes') : i18n.t('common.no')"
                  [tone]="item.met ? 'success' : 'warning'"
                />
                <span>{{ i18n.t(item.key) }}</span>
              </li>
            }
          </ul>
        </section>

        <section class="st-card" [attr.aria-label]="i18n.t('internshipDocs.title')">
          <div class="st-card__head">
            <h2 class="st-card__title">{{ i18n.t('internshipDocs.title') }}</h2>
            @if (canUpload()) {
              <button
                type="button"
                class="st-btn st-btn--primary st-no-print"
                (click)="openUpload()"
              >
                <st-icon name="upload" [size]="14" /> {{ i18n.t('internshipDocs.upload') }}
              </button>
            }
          </div>
          @if (dossier.documents.length === 0) {
            <st-empty-state
              [title]="i18n.t('common.empty.title')"
              [body]="i18n.t('internshipDocs.empty')"
            />
          } @else {
            @for (group of groupedDocs(dossier.documents); track group.key) {
              <h3 class="st-sub">{{ i18n.t(group.key) }}</h3>
              <ul class="st-docs">
                @for (item of group.items; track item.id) {
                  <li
                    class="st-docrow"
                    [class.st-docrow--restricted]="item.document.restrictedAccess"
                  >
                    <div class="st-docrow__meta">
                      <strong dir="auto">{{ item.document.originalFileName }}</strong>
                      <span class="st-docrow__sub" dir="auto">
                        {{ item.document.type }} · {{ item.document.reference }} ·
                        {{ formatSize(item.document.sizeBytes) }} ·
                        {{ item.document.mimeType }}
                      </span>
                      <span class="st-docrow__badges">
                        @if (item.mandatory) {
                          <st-badge [label]="i18n.t('dossier.mandatory')" tone="info" />
                        }
                        @if (item.generatedAutomatically) {
                          <st-badge [label]="i18n.t('internshipDocs.generated')" tone="neutral" />
                        }
                        @if (item.document.restrictedAccess) {
                          <st-badge
                            [label]="i18n.t('common.sensitive')"
                            tone="restricted"
                            icon="shield"
                          />
                        }
                      </span>
                    </div>
                    <div class="st-docrow__actions st-no-print">
                      <button
                        type="button"
                        class="st-btn st-btn--secondary"
                        [disabled]="isRestrictedBlocked(item) || busyDoc() === item.id + ':preview'"
                        (click)="openDoc(item, true)"
                      >
                        <st-icon name="eye" [size]="14" /> {{ i18n.t('common.preview') }}
                      </button>
                      <button
                        type="button"
                        class="st-btn st-btn--secondary"
                        [disabled]="
                          isRestrictedBlocked(item) || busyDoc() === item.id + ':download'
                        "
                        (click)="openDoc(item, false)"
                      >
                        <st-icon name="download" [size]="14" /> {{ i18n.t('common.download') }}
                      </button>
                    </div>
                  </li>
                }
              </ul>
            }
          }
          @if (docForbiddenNote()) {
            <st-alert tone="warning">{{ i18n.t('internshipDocs.restrictedBlocked') }}</st-alert>
          }
          <p class="st-hint">{{ i18n.t('internshipDocs.verifyNote') }}</p>
        </section>

        <!-- Print-only completion summary: references only, never PDF content. -->
        <section class="st-print-only" aria-label="print summary">
          <h2>{{ dossier.internship.reference }}</h2>
          <p dir="auto">{{ dossier.internship.candidateFullName }}</p>
          <p dir="ltr">{{ dossier.internship.startDate }} → {{ dossier.internship.endDate }}</p>
          <p>
            {{ dossier.internship.type }} · {{ dossier.internship.requirement }} ·
            {{ dossier.internship.status }}
          </p>
          <ul>
            @for (item of checklist(dossier); track item.key) {
              <li>{{ item.met ? '[x]' : '[ ]' }} {{ i18n.t(item.key) }}</li>
            }
          </ul>
          <ul>
            @for (item of dossier.documents; track item.id) {
              <li dir="auto">{{ item.document.type }} · {{ item.document.reference }}</li>
            }
          </ul>
          @if (certificate(); as cert) {
            <p dir="ltr">{{ cert.reference }} · {{ cert.status }}</p>
          }
        </section>
      }

      @if (tab() === 'timeline') {
        <section class="st-card" [attr.aria-label]="i18n.t('internshipDetail.timeline')">
          <h2 class="st-card__title">{{ i18n.t('internshipDetail.timeline') }}</h2>
          @if (dossier.workflow) {
            <p class="st-hint" dir="auto">
              {{ dossier.workflow.definitionName }} · {{ dossier.workflow.currentStepName }} ·
              {{ dossier.workflow.status }}
            </p>
          }
          @if (dossier.actionsRestricted || (!dossier.workflow && dossier.actions.length === 0)) {
            <st-alert tone="warning">{{ i18n.t('internshipDetail.timelineRestricted') }}</st-alert>
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

      <!-- Dates editor -->
      <st-dialog
        [open]="datesOpen()"
        [title]="i18n.t('internshipDetail.editDates')"
        (close)="datesOpen.set(false)"
      >
        <st-alert tone="warning" [title]="i18n.t('internshipDetail.datesWarningTitle')">
          {{ i18n.t('internshipDetail.datesWarningBody') }}
        </st-alert>
        <div class="st-grid2">
          <label class="st-field">
            <span class="st-field__label">{{ i18n.t('internshipDetail.startDate') }} *</span>
            <input type="date" class="st-input" [(ngModel)]="datesForm.startDate" />
          </label>
          <label class="st-field">
            <span class="st-field__label">{{ i18n.t('internshipDetail.endDate') }} *</span>
            <input type="date" class="st-input" [(ngModel)]="datesForm.endDate" />
          </label>
        </div>
        @if (isObservation()) {
          <fieldset class="st-radio">
            <legend>{{ i18n.t('internshipDetail.observationFlag') }}</legend>
            <label>
              <input
                type="radio"
                name="obsflag"
                [value]="true"
                [(ngModel)]="datesForm.observationObligatoire"
              />
              {{ i18n.t('internshipDetail.obligatoire') }}
            </label>
            <label>
              <input
                type="radio"
                name="obsflag"
                [value]="false"
                [(ngModel)]="datesForm.observationObligatoire"
              />
              {{ i18n.t('internshipDetail.optional') }}
            </label>
          </fieldset>
        } @else {
          <p class="st-hint">{{ i18n.t('internshipDetail.nonObservationNote') }}</p>
        }
        @if (datesError()) {
          <st-alert tone="error">{{ datesError() }}</st-alert>
        }
        <div slot="footer" class="st-dialog__actions">
          <button type="button" class="st-btn st-btn--secondary" (click)="datesOpen.set(false)">
            {{ i18n.t('common.cancel') }}
          </button>
          <button
            type="button"
            class="st-btn st-btn--primary"
            [disabled]="busy()"
            (click)="saveDates()"
          >
            {{ i18n.t('common.save') }}
          </button>
        </div>
      </st-dialog>

      <!-- Assign / reassign -->
      <st-dialog
        [open]="assignOpen()"
        [title]="
          currentAssignment()
            ? i18n.t('internshipDetail.reassign')
            : i18n.t('internshipDetail.assign')
        "
        (close)="assignOpen.set(false)"
      >
        @if (currentAssignment(); as current) {
          <st-alert tone="warning">
            {{
              i18n.t('internshipDetail.reassignConsequence', {
                name: current.supervisorName,
                department: current.departmentName,
              })
            }}
          </st-alert>
        }
        @if (refLoading()) {
          <st-skeleton [rows]="3" />
        } @else {
          <div class="st-grid2">
            <label class="st-field">
              <span class="st-field__label">{{ i18n.t('internshipDetail.department') }} *</span>
              <select class="st-input" [(ngModel)]="assignForm.departmentId">
                <option value="">—</option>
                @for (d of departments(); track d.id) {
                  <option [value]="d.id">{{ d.name }} ({{ d.code }})</option>
                }
              </select>
            </label>
            <label class="st-field">
              <span class="st-field__label">{{ i18n.t('internshipDetail.supervisor') }} *</span>
              <select class="st-input" [(ngModel)]="assignForm.supervisorId">
                <option value="">—</option>
                @for (e of activeEmployees(); track e.id) {
                  <option [value]="e.id">
                    {{ e.firstName }} {{ e.lastName }} · {{ e.position || e.employeeNumber }}
                  </option>
                }
              </select>
            </label>
            <label class="st-field">
              <span class="st-field__label">{{ i18n.t('internshipDetail.startDate') }}</span>
              <input type="date" class="st-input" [(ngModel)]="assignForm.startDate" />
            </label>
            <label class="st-field">
              <span class="st-field__label">{{ i18n.t('internshipDetail.endDate') }}</span>
              <input type="date" class="st-input" [(ngModel)]="assignForm.endDate" />
            </label>
          </div>
          <label class="st-field">
            <span class="st-field__label">{{ i18n.t('internshipDetail.reason') }}</span>
            <textarea
              class="st-input"
              rows="3"
              [(ngModel)]="assignForm.assignmentReason"
              dir="auto"
            ></textarea>
          </label>
        }
        @if (assignError()) {
          <st-alert tone="error">{{ assignError() }}</st-alert>
        }
        <div slot="footer" class="st-dialog__actions">
          <button type="button" class="st-btn st-btn--secondary" (click)="assignOpen.set(false)">
            {{ i18n.t('common.cancel') }}
          </button>
          <button
            type="button"
            class="st-btn st-btn--primary"
            [disabled]="busy() || !assignForm.departmentId || !assignForm.supervisorId"
            (click)="saveAssign()"
          >
            {{ i18n.t('common.confirm') }}
          </button>
        </div>
      </st-dialog>

      <st-confirm-dialog
        [open]="confirmAction() !== null"
        [title]="confirmTitle()"
        [body]="confirmBody()"
        [confirmLabel]="i18n.t('common.confirm')"
        [cancelLabel]="i18n.t('common.cancel')"
        [busy]="busy()"
        (confirmed)="doConfirm()"
        (cancel)="confirmAction.set(null)"
      />

      <!-- Staff upload + attach -->
      <st-dialog
        [open]="uploadOpen()"
        [title]="i18n.t('internshipDocs.uploadTitle')"
        (close)="uploadOpen.set(false)"
      >
        <p class="st-hint">{{ i18n.t('internshipDocs.uploadHint') }}</p>
        <div class="st-grid2">
          <label class="st-field">
            <span class="st-field__label">{{ i18n.t('internshipDocs.docType') }} *</span>
            <select class="st-input" [(ngModel)]="uploadType">
              @for (t of uploadTypes; track t) {
                <option [value]="t">{{ t }}</option>
              }
            </select>
          </label>
          <label class="st-field st-field--check">
            <input type="checkbox" [(ngModel)]="uploadMandatory" />
            <span>{{ i18n.t('dossier.mandatory') }}</span>
          </label>
        </div>
        <label class="st-field">
          <span class="st-field__label">{{ i18n.t('internshipDocs.file') }} *</span>
          <input type="file" class="st-input" (change)="onUploadFile($event)" />
        </label>
        @if (uploadError()) {
          <st-alert tone="error">{{ uploadError() }}</st-alert>
        }
        <div slot="footer" class="st-dialog__actions">
          <button type="button" class="st-btn st-btn--secondary" (click)="uploadOpen.set(false)">
            {{ i18n.t('common.cancel') }}
          </button>
          <button
            type="button"
            class="st-btn st-btn--primary"
            [disabled]="busy() || !uploadFile"
            (click)="submitUpload()"
          >
            {{ i18n.t('internshipDocs.attach') }}
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
      .st-grid2 {
        display: grid;
        gap: 0.6rem;
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
      .st-card__head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 0.5rem;
        flex-wrap: wrap;
      }
      .st-card__title {
        margin: 0 0 0.6rem;
        font-size: 0.95rem;
      }
      .st-card__head .st-card__title {
        margin-block-end: 0;
      }
      .st-sub {
        font-size: 0.85rem;
        margin: 0.9rem 0 0.4rem;
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
      .st-rule {
        font-size: 0.82rem;
        background: var(--bg-page);
        border-radius: 0.45rem;
        padding: 0.5rem 0.65rem;
        overflow-wrap: anywhere;
      }
      .st-table-wrap {
        overflow-x: auto;
        border: 1px solid var(--border-subtle);
        border-radius: 0.6rem;
        margin-block-start: 0.4rem;
      }
      .st-table {
        inline-size: 100%;
        border-collapse: collapse;
        font-size: 0.83rem;
        min-inline-size: 34rem;
      }
      thead th {
        text-align: start;
        font-size: 0.72rem;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--text-muted);
        padding: 0.6rem 0.75rem;
        border-block-end: 1px solid var(--border-subtle);
      }
      tbody td {
        padding: 0.55rem 0.75rem;
        border-block-end: 1px solid var(--border-subtle);
      }
      tbody tr:last-child td {
        border-block-end: 0;
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
      .st-dialog__actions {
        display: flex;
        gap: 0.5rem;
        justify-content: flex-end;
      }
      .st-checks {
        list-style: none;
        margin: 0.6rem 0 0;
        padding: 0;
        display: grid;
        gap: 0.45rem;
      }
      .st-check {
        display: flex;
        gap: 0.55rem;
        align-items: center;
        font-size: 0.85rem;
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
      .st-docrow__actions {
        display: flex;
        gap: 0.4rem;
        flex-wrap: wrap;
      }
      .st-field--check {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 0.5rem;
      }
      .st-field--check input {
        inline-size: 1.1rem;
        block-size: 1.1rem;
      }
      .st-print-only {
        display: none;
      }
      @media (max-width: 900px) {
        .st-grid,
        .st-grid2 {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class InternshipDetailComponent implements OnInit {
  readonly i18n = inject(I18nService);
  readonly auth = inject(AuthService);
  private readonly crumbs = inject(BreadcrumbService);
  private readonly service = inject(InternshipService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal(false);
  readonly errorMessage = signal('');
  readonly bundle = signal<InternshipBundle | null>(null);
  readonly tab = signal('overview');

  readonly datesOpen = signal(false);
  readonly datesError = signal('');
  readonly datesForm = { startDate: '', endDate: '', observationObligatoire: false as boolean };

  readonly assignOpen = signal(false);
  readonly refLoading = signal(false);
  readonly assignError = signal('');
  readonly departments = signal<readonly Department[]>([]);
  readonly employees = signal<readonly Employee[]>([]);
  readonly assignForm = {
    departmentId: '',
    supervisorId: '',
    startDate: '',
    endDate: '',
    assignmentReason: '',
  };

  readonly confirmAction = signal<'activate' | 'complete' | 'cancel' | 'certificate' | null>(null);
  readonly certificate = signal<CertificateInfo | null>(null);

  readonly uploadOpen = signal(false);
  readonly uploadError = signal('');
  readonly uploadTypes = INTERNSHIP_UPLOAD_TYPES;
  uploadType: DocumentType = 'STEG_INTERNSHIP_REPORT';
  uploadMandatory = false;
  uploadFile: File | null = null;
  readonly docForbiddenNote = signal(false);
  readonly busyDoc = signal<string | null>(null);

  currentAssignment(): InternshipAssignment | null {
    const bundle = this.bundle();
    return bundle ? activeAssignment(bundle.assignments) : null;
  }

  activeEmployees(): readonly Employee[] {
    return this.employees().filter((e) => e.active);
  }

  isObservation(): boolean {
    return this.bundle()?.internship.type === 'OBSERVATION';
  }

  tabs(): { id: string; label: string; count?: number }[] {
    const bundle = this.bundle();
    return [
      { id: 'overview', label: this.i18n.t('internshipDetail.tabOverview') },
      {
        id: 'assignment',
        label: this.i18n.t('internshipDetail.tabAssignment'),
        count: bundle?.assignments.length,
      },
      {
        id: 'documents',
        label: this.i18n.t('internshipDetail.tabDocuments'),
        count: bundle?.documents.length,
      },
      {
        id: 'timeline',
        label: this.i18n.t('internshipDetail.tabTimeline'),
        count: bundle?.actions.length,
      },
    ];
  }

  canManage(): boolean {
    return this.auth.hasPermission('INTERNSHIP_ASSIGN');
  }

  canSeeCertificate(status: string): boolean {
    if (!this.auth.hasPermission('INTERNSHIP_VIEW')) return false;
    const role = this.auth.role();
    return status === 'COMPLETED' && (role === 'ADMIN' || role === 'HR' || role === 'SUPERVISOR');
  }

  ngOnInit(): void {
    this.crumbs.set([
      { labelKey: 'nav.internships', labelFallback: 'Internships', url: '/internships' },
      { labelKey: 'internshipDetail.title', labelFallback: 'Internship' },
    ]);
    this.load();
  }

  load(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      void this.router.navigate(['/internships']);
      return;
    }
    this.loading.set(true);
    this.error.set(false);
    this.errorMessage.set('');
    this.service.loadBundle(id).subscribe({
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

  openDates(): void {
    const internship = this.bundle()?.internship;
    if (!internship) return;
    this.datesForm.startDate = internship.startDate;
    this.datesForm.endDate = internship.endDate;
    this.datesForm.observationObligatoire = internship.requirement === 'OBLIGATOIRE';
    this.datesError.set('');
    this.datesOpen.set(true);
  }

  saveDates(): void {
    const id = this.bundle()?.internship.id;
    if (!id) return;
    if (!this.datesForm.startDate || !this.datesForm.endDate) {
      this.datesError.set(this.i18n.t('internshipDetail.datesRequired'));
      return;
    }
    if (this.datesForm.endDate < this.datesForm.startDate) {
      this.datesError.set(this.i18n.t('internshipDetail.datesInvalid'));
      return;
    }
    this.busy.set(true);
    this.service
      .updateDates(id, {
        startDate: this.datesForm.startDate,
        endDate: this.datesForm.endDate,
        // Only meaningful for observation; the backend ignores/forces otherwise.
        observationObligatoire: this.isObservation() ? this.datesForm.observationObligatoire : null,
      })
      .subscribe({
        next: (updated) => {
          this.busy.set(false);
          this.datesOpen.set(false);
          this.toast.show(
            'success',
            this.i18n.t('internshipDetail.datesSaved', {
              type: updated.type,
              requirement: updated.requirement,
            }),
          );
          this.load();
        },
        error: (e: unknown) => {
          this.busy.set(false);
          this.datesError.set(actionErrorMessage(e, this.i18n));
        },
      });
  }

  openAssign(): void {
    this.assignForm.departmentId = '';
    this.assignForm.supervisorId = '';
    this.assignForm.startDate = '';
    this.assignForm.endDate = '';
    this.assignForm.assignmentReason = '';
    this.assignError.set('');
    this.assignOpen.set(true);
    if (this.departments().length === 0) {
      this.refLoading.set(true);
      this.service.referenceData().subscribe({
        next: ({ departments, employees }) => {
          this.departments.set(departments.filter((d) => d.active));
          this.employees.set(employees);
          this.refLoading.set(false);
        },
        error: (e: unknown) => {
          this.refLoading.set(false);
          this.assignError.set(actionErrorMessage(e, this.i18n));
        },
      });
    }
  }

  saveAssign(): void {
    const id = this.bundle()?.internship.id;
    if (!id || !this.assignForm.departmentId || !this.assignForm.supervisorId) return;
    this.busy.set(true);
    this.service
      .assign(id, {
        departmentId: this.assignForm.departmentId,
        supervisorId: this.assignForm.supervisorId,
        ...(this.assignForm.startDate ? { startDate: this.assignForm.startDate } : {}),
        ...(this.assignForm.endDate ? { endDate: this.assignForm.endDate } : {}),
        ...(this.assignForm.assignmentReason.trim()
          ? { assignmentReason: this.assignForm.assignmentReason.trim() }
          : {}),
      })
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.assignOpen.set(false);
          this.toast.show('success', this.i18n.t('internshipDetail.assignSaved'));
          this.load();
        },
        error: (e: unknown) => {
          this.busy.set(false);
          this.assignError.set(actionErrorMessage(e, this.i18n));
        },
      });
  }

  confirmTitle(): string {
    switch (this.confirmAction()) {
      case 'activate':
        return this.i18n.t('internshipDetail.activate');
      case 'complete':
        return this.i18n.t('internshipDetail.complete');
      case 'cancel':
        return this.i18n.t('internshipDetail.cancel');
      default:
        return this.i18n.t('internshipDetail.generateCertificate');
    }
  }

  confirmBody(): string {
    switch (this.confirmAction()) {
      case 'activate':
        return this.i18n.t('internshipDetail.activateBody');
      case 'complete':
        return this.i18n.t('internshipDetail.completeBody');
      case 'cancel':
        return this.i18n.t('internshipDetail.cancelBody');
      default:
        return this.i18n.t('internshipDetail.certificateBody');
    }
  }

  doConfirm(): void {
    const action = this.confirmAction();
    const id = this.bundle()?.internship.id;
    if (!action || !id) return;
    this.busy.set(true);
    const done = (message: string) => {
      this.busy.set(false);
      this.confirmAction.set(null);
      this.toast.show('success', message);
      this.load();
    };
    const fail = (e: unknown) => {
      this.busy.set(false);
      this.confirmAction.set(null);
      this.toast.show('error', actionErrorMessage(e, this.i18n));
    };
    if (action === 'activate')
      this.service
        .activate(id)
        .subscribe({ next: () => done(this.i18n.t('internshipDetail.activated')), error: fail });
    else if (action === 'complete')
      this.service
        .complete(id)
        .subscribe({ next: () => done(this.i18n.t('internshipDetail.completed')), error: fail });
    else if (action === 'cancel')
      this.service
        .cancel(id)
        .subscribe({ next: () => done(this.i18n.t('internshipDetail.cancelled')), error: fail });
    else
      this.service.generateCertificate(id).subscribe({
        next: (cert) => {
          this.certificate.set(cert);
          this.busy.set(false);
          this.confirmAction.set(null);
          this.toast.show('success', this.i18n.t('internshipDetail.certificateGenerated'));
        },
        error: fail,
      });
  }

  downloadCert(cert: CertificateInfo): void {
    this.busy.set(true);
    this.service.downloadCertificate(cert.id).subscribe({
      next: (blob) => {
        this.busy.set(false);
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `${cert.reference}.pdf`;
        anchor.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      },
      error: (e: unknown) => {
        this.busy.set(false);
        this.toast.show('error', actionErrorMessage(e, this.i18n));
      },
    });
  }

  /* ---------------- Documents tab ---------------- */

  canUpload(): boolean {
    return this.auth.hasPermission('INTERNSHIP_ASSIGN');
  }

  canViewRestrictedDocs(): boolean {
    return this.auth.hasPermission('DOCUMENT_VIEW_RESTRICTED');
  }

  isRestrictedBlocked(item: InternshipDocumentItem): boolean {
    return item.document.restrictedAccess && !this.canViewRestrictedDocs();
  }

  /** Presence-only checklist from backend-exposed prerequisites (finance decides). */
  checklist(bundle: InternshipBundle): { key: string; met: boolean }[] {
    const present = new Set(bundle.documents.map((d) => d.document.type));
    return [
      { key: 'internshipDocs.checkCompleted', met: bundle.internship.status === 'COMPLETED' },
      { key: 'internshipDocs.checkAssignment', met: activeAssignment(bundle.assignments) !== null },
      {
        key: 'internshipDocs.checkRequiredDocs',
        met: REQUIRED_DOSSIER_TYPES.every((t) => present.has(t)),
      },
      { key: 'internshipDocs.checkEligible', met: bundle.internship.paymentEligible },
      { key: 'internshipDocs.checkCertificate', met: this.certificate() !== null },
    ];
  }

  groupedDocs(
    documents: readonly InternshipDocumentItem[],
  ): { key: string; items: InternshipDocumentItem[] }[] {
    const groups: { key: string; items: InternshipDocumentItem[] }[] = [
      { key: 'internshipDocs.groupRestricted', items: [] },
      { key: 'internshipDocs.groupRequired', items: [] },
      { key: 'internshipDocs.groupReports', items: [] },
      { key: 'internshipDocs.groupCertificates', items: [] },
      { key: 'internshipDocs.groupOther', items: [] },
    ];
    for (const item of documents) {
      const type = item.document.type;
      if (item.document.restrictedAccess) groups[0]?.items.push(item);
      else if ((REQUIRED_DOSSIER_TYPES as readonly string[]).includes(type))
        groups[1]?.items.push(item);
      else if (
        type === 'STEG_INTERNSHIP_REPORT' ||
        type === 'CAHIER_DES_CHARGES' ||
        type === 'PROJECT_DEMO_IMAGE'
      )
        groups[2]?.items.push(item);
      else if (
        type === 'INTERNSHIP_CERTIFICATE' ||
        type === 'INTERNSHIP_LOGBOOK' ||
        type === 'INTERNSHIP_CONVENTION'
      )
        groups[3]?.items.push(item);
      else groups[4]?.items.push(item);
    }
    return groups.filter((g) => g.items.length > 0);
  }

  openUpload(): void {
    this.uploadType = 'STEG_INTERNSHIP_REPORT';
    this.uploadMandatory = false;
    this.uploadFile = null;
    this.uploadError.set('');
    this.uploadOpen.set(true);
  }

  onUploadFile(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0] ?? null;
    this.uploadError.set('');
    if (!file) {
      this.uploadFile = null;
      return;
    }
    // Indicative client pre-check only (25 MB); backend validates MIME/size/content.
    if (file.size > 25 * 1024 * 1024) {
      this.uploadError.set(this.i18n.t('internshipDocs.fileTooLarge'));
      this.uploadFile = null;
      return;
    }
    this.uploadFile = file;
  }

  submitUpload(): void {
    const id = this.bundle()?.internship.id;
    const file = this.uploadFile;
    if (!id || !file) return;
    this.busy.set(true);
    this.service.uploadThenAttach(id, this.uploadType, file, this.uploadMandatory).subscribe({
      next: () => {
        this.busy.set(false);
        this.uploadOpen.set(false);
        this.toast.show('success', this.i18n.t('internshipDocs.uploaded'));
        this.load();
      },
      error: (e: unknown) => {
        this.busy.set(false);
        this.uploadError.set(actionErrorMessage(e, this.i18n));
      },
    });
  }

  openDoc(item: InternshipDocumentItem, preview: boolean): void {
    if (this.isRestrictedBlocked(item)) {
      this.docForbiddenNote.set(true);
      return;
    }
    const tag = `${item.id}:${preview ? 'preview' : 'download'}`;
    this.busyDoc.set(tag);
    this.service.downloadDocument(item.document.id, item.document.restrictedAccess).subscribe({
      next: (blob) => {
        this.busyDoc.set(null);
        const url = URL.createObjectURL(blob);
        if (preview) {
          window.open(url, '_blank', 'noopener');
          window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
        } else {
          const anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = item.document.originalFileName || `${item.document.reference}.pdf`;
          anchor.click();
          window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
        }
      },
      error: (e: unknown) => {
        this.busyDoc.set(null);
        if (isForbidden(e)) {
          this.docForbiddenNote.set(true);
          this.toast.show('error', this.i18n.t('internshipDocs.restrictedBlocked'));
        } else {
          this.toast.show('error', actionErrorMessage(e, this.i18n));
        }
      },
    });
  }

  printSummary(): void {
    document.body.classList.add('st-printing-summary');
    const done = (): void => {
      document.body.classList.remove('st-printing-summary');
      window.removeEventListener('afterprint', done);
    };
    window.addEventListener('afterprint', done);
    window.print();
    // Fallback for browsers without afterprint.
    window.setTimeout(() => document.body.classList.remove('st-printing-summary'), 2000);
  }

  formatSize(bytes: number): string {
    if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
    if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${bytes} B`;
  }

  statusTone(status: string): BadgeTone {
    switch (status) {
      case 'ACTIVE':
        return 'success';
      case 'COMPLETED':
        return 'info';
      case 'CANCELLED':
      case 'ARCHIVED':
        return 'error';
      default:
        return 'warning';
    }
  }

  assignmentTone(status: string): BadgeTone {
    switch (status) {
      case 'ACTIVE':
        return 'success';
      case 'PLANNED':
        return 'info';
      case 'CANCELLED':
        return 'error';
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
      case 'NEEDS_CORRECTION':
      case 'RETURNED':
        return 'warning';
      default:
        return 'neutral';
    }
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

function actionErrorMessage(error: unknown, i18n: I18nService): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    (error as { status?: number }).status === 403
  ) {
    return i18n.t('common.forbidden.body');
  }
  const message = extractMessage(error);
  return message || i18n.t('common.error.body');
}
