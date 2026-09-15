import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, of, catchError, switchMap, map, throwError } from 'rxjs';
import { ApiClient } from '../../core/api-client.service';
import type {
  FinanceCaseDetail,
  FinanceCaseDocument,
  InternshipDetail,
  InternshipAssignment,
  DocumentFile,
  FinanceDocumentReviewBody,
  AiAnalysisResult,
  AiRecommendation,
} from '../../core/api-models';
import { activeAssignment } from '../internships/internship.service';

export interface FinanceDossierDoc extends FinanceCaseDocument {
  /** Storage metadata for filename preview/download decisions (null when denied). */
  meta: DocumentFile | null;
}

export interface FinanceCaseBundle {
  readonly financeCase: FinanceCaseDetail;
  readonly internship: InternshipDetail | null;
  readonly assignment: InternshipAssignment | null;
  readonly docs: readonly FinanceDossierDoc[];
}

/**
 * Facade for the finance workspace. No payment math here — amounts are
 * rendered verbatim from the backend snapshot. HTTP 403/409 surface as
 * clean, actionable errors; the backend remains the decision authority.
 */
@Injectable({ providedIn: 'root' })
export class FinanceService {
  private readonly api = inject(ApiClient);

  loadCase(caseId: string): Observable<FinanceCaseBundle> {
    return this.api.getFinanceCase(caseId).pipe(
      switchMap((financeCase) =>
        forkJoin({
          internship: this.api
            .getInternship(financeCase.internshipId)
            .pipe(catchError(() => of(null))),
          assignments: this.api
            .listAssignments(financeCase.internshipId)
            .pipe(catchError(() => of([]))),
          metas: this.loadDocMetas(financeCase.documents.map((d) => d.documentId)),
        }).pipe(
          map(({ internship, assignments, metas }) => ({
            financeCase,
            internship,
            assignment: activeAssignment(assignments),
            docs: financeCase.documents.map((d) => ({
              ...d,
              meta: metas.get(d.documentId) ?? null,
            })),
          })),
        ),
      ),
    );
  }

  /** Metadata per dossier document; denials isolated per row (restricted CIN). */
  private loadDocMetas(ids: readonly string[]): Observable<Map<string, DocumentFile>> {
    if (ids.length === 0) return of(new Map());
    return forkJoin(
      ids.map((id) =>
        this.api.getDocumentMetadata(id).pipe(
          map((meta): [string, DocumentFile] => [id, meta]),
          catchError((): Observable<[string, DocumentFile] | null> => of(null)),
        ),
      ),
    ).pipe(map((pairs) => new Map(pairs.filter((p): p is [string, DocumentFile] => p !== null))));
  }

  recalculate(caseId: string): Observable<FinanceCaseDetail> {
    return this.api.recalculateCase(caseId);
  }

  approve(caseId: string, comment?: string): Observable<FinanceCaseDetail> {
    return this.api.approveCase(caseId, comment);
  }

  reject(caseId: string, reason: string): Observable<FinanceCaseDetail> {
    return this.api.rejectCase(caseId, reason);
  }

  downloadReceipt(caseId: string): Observable<Blob> {
    return this.api.downloadReceipt(caseId);
  }

  reviewDocument(
    caseId: string,
    documentId: string,
    body: FinanceDocumentReviewBody,
  ): Observable<FinanceCaseDocument> {
    return this.api.reviewFinanceDocument(caseId, documentId, body);
  }

  downloadDocument(documentId: string, restricted: boolean): Observable<Blob> {
    return this.api.downloadDocument(documentId, restricted);
  }

  analyze(caseId: string): Observable<AiAnalysisResult> {
    return this.api.analyzeFinanceCase(caseId);
  }

  reviewRecommendation(
    recommendationId: string,
    status: 'ACCEPTED_BY_HUMAN' | 'DISMISSED',
  ): Observable<AiRecommendation> {
    return this.api.reviewAiRecommendation(recommendationId, status);
  }
}

export function isForbidden(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { status?: number }).status === 403
  );
}

export function isConflict(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { status?: number }).status === 409
  );
}
