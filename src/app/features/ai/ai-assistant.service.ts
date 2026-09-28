import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, of, map, catchError, switchMap } from 'rxjs';
import { ApiClient } from '../../core/api-client.service';
import { activeAssignment } from '../internships/internship.service';
import type { ApplicationDetail, GroupCountDto, InternshipDetail } from '../../core/api-models';
import { countOf } from '../../core/api-models';

export type AssistPriority = 'high' | 'medium' | 'low';

export interface AssistTask {
  readonly id: string;
  readonly kind:
    | 'review-application'
    | 'missing-documents'
    | 'validate-internship'
    | 'generate-certificate'
    | 'monitor-ending'
    | 'review-evaluation';
  readonly priority: AssistPriority;
  readonly titleKey: string;
  /** Interpolation params for the title. */
  readonly titleParams: Record<string, string>;
  readonly link: string;
  readonly dueDate: string | null;
}

export interface AssistInsight {
  readonly textKey: string;
  readonly textParams: Record<string, string>;
  readonly link: string;
}

export interface AssistData {
  readonly applications: readonly ApplicationDetail[];
  readonly internships: readonly InternshipDetail[];
  readonly appsByStatus: readonly GroupCountDto[];
  readonly internshipsByStatus: readonly GroupCountDto[];
  readonly financeByStatus: readonly GroupCountDto[];
  /** Supervisor scope name ('' = all). */
  readonly scope: string;
  /** Internship ids assigned to the scoped supervisor. */
  readonly scopedIds: ReadonlySet<string>;
}

/**
 * Rule-based administrative assistance engine.
 *
 * Deterministic by design: every figure traces to a backend read
 * (reports + queues); priorities come from explicit business rules, never
 * from a language model. AI-sounding summaries are always labeled as
 * rule-based so a supervisor can trust and verify each number.
 * Gemini/Python services stay behind Spring Boot; this engine degrades
 * gracefully when any read fails.
 */
@Injectable({ providedIn: 'root' })
export class AiAssistantService {
  private readonly api = inject(ApiClient);

  load(scope: string, assignments: Map<string, string>): Observable<AssistData> {
    return forkJoin({
      applications: this.api
        .listApplications()
        .pipe(catchError((): Observable<readonly ApplicationDetail[]> => of([]))),
      internships: this.api
        .listInternships()
        .pipe(catchError((): Observable<readonly InternshipDetail[]> => of([]))),
      appsByStatus: this.api
        .getApplicationsByStatus()
        .pipe(catchError((): Observable<readonly GroupCountDto[]> => of([]))),
      internshipsByStatus: this.api
        .getInternshipsByStatus()
        .pipe(catchError((): Observable<readonly GroupCountDto[]> => of([]))),
      financeByStatus: this.api
        .getFinanceCasesByStatus()
        .pipe(catchError((): Observable<readonly GroupCountDto[]> => of([]))),
    }).pipe(
      map((r) => {
        const scopedIds = new Set<string>();
        if (scope) {
          for (const [id, name] of assignments) if (name === scope) scopedIds.add(id);
        }
        return { ...r, scope, scopedIds };
      }),
    );
  }

  /** Assignment map internshipId → current supervisor name (fail-soft). */
  loadAssignmentNames(ids: readonly string[]): Observable<Map<string, string>> {
    if (ids.length === 0) return of(new Map());
    const calls = ids.map((id) =>
      this.api.listAssignments(id).pipe(
        map((rows) => {
          const current = activeAssignment(rows);
          return [id, current?.supervisorName ?? ''] as const;
        }),
        catchError(() => of([id, ''] as const)),
      ),
    );
    return forkJoin(calls).pipe(map((pairs) => new Map(pairs)));
  }

  /**
   * Full data load with supervisor scoping resolved: internships first,
   * then assignment names, then the complete dataset. Empty scope = all.
   */
  loadScoped(scope: string): Observable<AssistData> {
    return this.load(scope, new Map()).pipe(
      switchMap((data) => {
        if (!scope || data.internships.length === 0) return of(data);
        return this.loadAssignmentNames(data.internships.map((i) => i.id)).pipe(
          switchMap((names) => this.load(scope, names)),
          catchError(() => of(data)),
        );
      }),
    );
  }

  inScope(data: AssistData, internshipId: string): boolean {
    return data.scope === '' || data.scopedIds.has(internshipId);
  }

  scopedInternships(data: AssistData): readonly InternshipDetail[] {
    if (!data.scope) return data.internships;
    return data.internships.filter((i) => data.scopedIds.has(i.id));
  }

  /** Pending-task list with transparent rule-based priorities. */
  tasks(data: AssistData): AssistTask[] {
    const out: AssistTask[] = [];
    // Review application — awaiting administrative review.
    for (const app of data.applications) {
      if (app.status === 'SUBMITTED' || app.status === 'UNDER_REVIEW') {
        out.push({
          id: `app-${app.id}`,
          kind: 'review-application',
          priority: agePriority(app.updatedAt, 7),
          titleKey: 'assistant.task.reviewApplication',
          titleParams: { ref: app.reference, name: app.candidateName },
          link: `/applications/${app.id}`,
          dueDate: null,
        });
      } else if (app.status === 'NEEDS_CORRECTION') {
        out.push({
          id: `doc-${app.id}`,
          kind: 'missing-documents',
          priority: 'medium',
          titleKey: 'assistant.task.missingDocuments',
          titleParams: { ref: app.reference, name: app.candidateName },
          link: `/applications/${app.id}`,
          dueDate: null,
        });
      }
    }
    // Internship validation / certificate / ending-soon.
    for (const intern of this.scopedInternships(data)) {
      if (intern.status === 'COMPLETED') {
        out.push({
          id: `val-${intern.id}`,
          kind: 'validate-internship',
          priority: agePriority(intern.updatedAt, 5),
          titleKey: 'assistant.task.validateInternship',
          titleParams: { ref: intern.reference, name: intern.candidateFullName },
          link: `/internships/${intern.id}`,
          dueDate: null,
        });
      } else if (intern.status === 'ACTIVE' && endsWithinDays(intern.endDate, 14)) {
        out.push({
          id: `end-${intern.id}`,
          kind: 'monitor-ending',
          priority: endsWithinDays(intern.endDate, 7) ? 'high' : 'medium',
          titleKey: 'assistant.task.monitorEnding',
          titleParams: {
            ref: intern.reference,
            name: intern.candidateFullName,
            date: intern.endDate,
          },
          link: `/internships/${intern.id}`,
          dueDate: intern.endDate,
        });
      }
    }
    const order: Record<AssistPriority, number> = { high: 0, medium: 1, low: 2 };
    return out.sort((a, b) => order[a.priority] - order[b.priority]);
  }

  /** Executive summary lines for the dashboard insights section. */
  insights(data: AssistData): AssistInsight[] {
    const out: AssistInsight[] = [];
    const pending = data.applications.filter(
      (a) => a.status === 'SUBMITTED' || a.status === 'UNDER_REVIEW',
    ).length;
    const corrections = data.applications.filter((a) => a.status === 'NEEDS_CORRECTION').length;
    const scoped = this.scopedInternships(data);
    const active = scoped.filter((i) => i.status === 'ACTIVE').length;
    const completed = scoped.filter((i) => i.status === 'COMPLETED').length;
    const ending = scoped.filter(
      (i) => i.status === 'ACTIVE' && endsWithinDays(i.endDate, 14),
    ).length;
    out.push({
      textKey: 'assistant.insight.activity',
      textParams: {
        pending: String(pending),
        active: String(active),
        completed: String(completed),
      },
      link: '/tasks',
    });
    if (corrections > 0) {
      out.push({
        textKey: 'assistant.insight.corrections',
        textParams: { n: String(corrections) },
        link: '/applications',
      });
    }
    if (ending > 0) {
      out.push({
        textKey: 'assistant.insight.ending',
        textParams: { n: String(ending) },
        link: '/supervisor',
      });
    }
    if (completed > 0) {
      out.push({
        textKey: 'assistant.insight.validation',
        textParams: { n: String(completed) },
        link: '/tasks',
      });
    }
    return out;
  }

  /**
   * Answers the suggested questions from live backend data.
   * Returns a translation key + params; unknown questions get a guidance key.
   */
  answer(question: string, data: AssistData): { key: string; params: Record<string, string> } {
    const q = question.toLowerCase();
    const scoped = this.scopedInternships(data);
    if (
      /(pending|awaiting|attente|en attente|قيد|معلقة|طلبات)/.test(q) &&
      /(application|candidature|ترشح|طلب)/.test(q)
    ) {
      const n = data.applications.filter(
        (a) => a.status === 'SUBMITTED' || a.status === 'UNDER_REVIEW',
      ).length;
      return { key: 'assistant.answer.pendingApplications', params: { n: String(n) } };
    }
    if (/(end|fin|se termine|ينتهي|month|mois|شهر)/.test(q)) {
      const rows = scoped.filter((i) => i.status === 'ACTIVE' && endsWithinDays(i.endDate, 31));
      const names = rows
        .slice(0, 5)
        .map((i) => `${i.candidateFullName} (${i.endDate})`)
        .join(', ');
      return {
        key: 'assistant.answer.endingSoon',
        params: { n: String(rows.length), names: names || '—' },
      };
    }
    if (/(missing|manquant|document|وثيقة|ناقصة|مفقود)/.test(q)) {
      const n =
        data.applications.filter((a) => a.status === 'NEEDS_CORRECTION').length +
        countOf(data.financeByStatus, 'DOCUMENTS_MISSING');
      return { key: 'assistant.answer.missingDocuments', params: { n: String(n) } };
    }
    if (/(validation|certificate|attestation|شهادة|تحقق|مصادقة)/.test(q)) {
      const n = scoped.filter((i) => i.status === 'COMPLETED').length;
      return { key: 'assistant.answer.awaitingValidation', params: { n: String(n) } };
    }
    if (/(task|tâche|مهمة|مهام|incomplete|progress|progression|تقدم)/.test(q)) {
      const active = scoped.filter((i) => i.status === 'ACTIVE').length;
      return { key: 'assistant.answer.progress', params: { n: String(active) } };
    }
    return { key: 'assistant.answer.guidance', params: {} };
  }
}

function agePriority(updatedAt: string, days: number): AssistPriority {
  const t = new Date(updatedAt).getTime();
  if (Number.isNaN(t)) return 'medium';
  return Date.now() - t > days * 86_400_000 ? 'high' : 'medium';
}

function endsWithinDays(endDate: string, days: number): boolean {
  if (!endDate) return false;
  const end = new Date(endDate + 'T23:59:59').getTime();
  if (Number.isNaN(end)) return false;
  const diff = Math.ceil((end - Date.now()) / 86_400_000);
  return diff >= 0 && diff <= days;
}
