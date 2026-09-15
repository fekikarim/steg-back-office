import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, of, map, catchError, switchMap, throwError } from 'rxjs';
import { ApiClient } from '../../core/api-client.service';
import type {
  ApplicationDetail,
  ApplicationDocumentItem,
  CandidateDetail,
  DocumentVerificationBody,
  WorkflowActionResponse,
  WorkflowInstanceResponse,
} from '../../core/api-models';

export interface DossierBundle {
  readonly application: ApplicationDetail;
  readonly candidate: CandidateDetail | null;
  readonly documents: readonly ApplicationDocumentItem[];
  readonly workflow: WorkflowInstanceResponse | null;
  readonly actions: readonly WorkflowActionResponse[];
  /** True when the workflow history endpoint denied access (staff scope). */
  readonly actionsRestricted: boolean;
}

/**
 * Facade over ApiClient for the review workspace. No business rules here —
 * transition legality, classification and payment eligibility stay backend-side.
 * HTTP 403 from any mutation surfaces as a clean, actionable error.
 */
@Injectable({ providedIn: 'root' })
export class ApplicationReviewService {
  private readonly api = inject(ApiClient);

  loadDossier(applicationId: string): Observable<DossierBundle> {
    return this.api.getApplication(applicationId).pipe(
      switchMap((application) =>
        forkJoin({
          candidate: this.api
            .getCandidate(application.candidateId)
            .pipe(catchError(() => of(null))),
          documents: this.api.getApplicationDocuments(applicationId).pipe(catchError(() => of([]))),
          workflow: this.api.getApplicationWorkflow(applicationId).pipe(catchError(() => of(null))),
        }).pipe(
          switchMap(({ candidate, documents, workflow }) => {
            if (!workflow) {
              return of({
                application,
                candidate,
                documents,
                workflow,
                actions: [],
                actionsRestricted: false,
              });
            }
            return this.api.listWorkflowActions(workflow.id).pipe(
              map((actions): DossierBundle => ({
                application,
                candidate,
                documents,
                workflow,
                actions,
                actionsRestricted: false,
              })),
              catchError((error: unknown) => {
                if (isForbidden(error)) {
                  return of({
                    application,
                    candidate,
                    documents,
                    workflow,
                    actions: [],
                    actionsRestricted: true,
                  });
                }
                return throwError(() => error);
              }),
            );
          }),
        ),
      ),
    );
  }

  /** SUBMITTED/NEEDS_CORRECTION → UNDER_REVIEW. */
  beginReview(applicationId: string): Observable<WorkflowActionResponse> {
    return this.api.executeApplicationTransition(applicationId, {
      actionType: 'VALIDATION',
      targetStepCode: 'UNDER_REVIEW',
    });
  }

  /** UNDER_REVIEW → ACCEPTED. Optional staff note stored as the action comment. */
  accept(applicationId: string, comment?: string): Observable<WorkflowActionResponse> {
    return this.api.executeApplicationTransition(applicationId, {
      actionType: 'APPROVAL',
      targetStepCode: 'FINAL_DECISION',
      decision: 'APPROVED',
      ...(comment?.trim() ? { comment: comment.trim() } : {}),
    });
  }

  /** UNDER_REVIEW → REJECTED. Backend stores a trimmed comment as rejectionReason. */
  reject(applicationId: string, reason: string): Observable<WorkflowActionResponse> {
    return this.api.executeApplicationTransition(applicationId, {
      actionType: 'APPROVAL',
      targetStepCode: 'FINAL_DECISION',
      decision: 'REJECTED',
      comment: reason.trim(),
    });
  }

  /** UNDER_REVIEW → NEEDS_CORRECTION. Backend stores a trimmed comment. */
  requestCorrection(applicationId: string, comment: string): Observable<WorkflowActionResponse> {
    return this.api.executeApplicationTransition(applicationId, {
      actionType: 'APPROVAL',
      targetStepCode: 'FINAL_DECISION',
      decision: 'NEEDS_CORRECTION',
      comment: comment.trim(),
    });
  }

  verifyDocument(
    applicationId: string,
    documentId: string,
    body: DocumentVerificationBody,
  ): Observable<ApplicationDocumentItem> {
    return this.api.verifyApplicationDocument(applicationId, documentId, body);
  }

  downloadDocument(documentId: string, restricted: boolean): Observable<Blob> {
    return this.api.downloadDocument(documentId, restricted);
  }
}

function isForbidden(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { status?: number }).status === 403
  );
}
