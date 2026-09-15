import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, of, catchError, map } from 'rxjs';
import { ApiClient } from '../../core/api-client.service';
import type {
  Department,
  DepartmentRequest,
  Employee,
  EmployeeRequest,
  AuditLogEntry,
  AuditQuery,
  Page,
} from '../../core/api-models';

export interface DepartmentNode {
  readonly department: Department;
  readonly children: DepartmentNode[];
  readonly depth: number;
}

/**
 * Builds a parent/child hierarchy from a flat department list.
 * Orphans (missing parent) become roots; cycles are cut defensively so a
 * corrupt payload can never hang the renderer. Sorted by name at each level.
 */
export function buildDepartmentTree(departments: readonly Department[]): DepartmentNode[] {
  const byId = new Map<string, Department>();
  for (const d of departments) byId.set(d.id, d);
  const childrenOf = new Map<string, Department[]>();
  const roots: Department[] = [];
  for (const d of departments) {
    const parent = d.parentDepartmentId ? byId.get(d.parentDepartmentId) : undefined;
    if (parent && parent.id !== d.id) {
      const list = childrenOf.get(parent.id) ?? [];
      list.push(d);
      childrenOf.set(parent.id, list);
    } else {
      roots.push(d);
    }
  }
  const byName = (a: Department, b: Department) => a.name.localeCompare(b.name);
  const visit = (dept: Department, depth: number, trail: readonly string[]): DepartmentNode => {
    const kids = (childrenOf.get(dept.id) ?? []).filter((c) => !trail.includes(c.id)).sort(byName);
    return {
      department: dept,
      children: kids.map((c) => visit(c, depth + 1, [...trail, dept.id])),
      depth,
    };
  };
  return roots.sort(byName).map((r) => visit(r, 0, [r.id]));
}

/** Flattens the tree depth-first (for parent pickers: self excluded by caller). */
export function flattenTree(nodes: readonly DepartmentNode[]): DepartmentNode[] {
  const out: DepartmentNode[] = [];
  for (const n of nodes) {
    out.push(n);
    out.push(...flattenTree(n.children));
  }
  return out;
}

/**
 * Facade for the administration workspace. Department/employee mutations and
 * audit reads go through here; user-account provisioning has no backend
 * endpoint and is therefore absent by design (UI marks it pending).
 * HTTP 403 surfaces as a clean, actionable error.
 */
@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly api = inject(ApiClient);

  loadOrganization(): Observable<{ departments: Department[]; employees: Employee[] }> {
    return forkJoin({
      departments: this.api.listDepartments().pipe(catchError(() => of([]))),
      employees: this.api.listEmployees().pipe(catchError(() => of([]))),
    });
  }

  createDepartment(body: DepartmentRequest): Observable<Department> {
    return this.api.createDepartment(body);
  }

  updateDepartment(id: string, body: DepartmentRequest): Observable<Department> {
    return this.api.updateDepartment(id, body);
  }

  deactivateDepartment(id: string): Observable<void> {
    return this.api.deactivateDepartment(id);
  }

  createEmployee(body: EmployeeRequest): Observable<Employee> {
    return this.api.createEmployee(body);
  }

  updateEmployee(id: string, body: EmployeeRequest): Observable<Employee> {
    return this.api.updateEmployee(id, body);
  }

  deactivateEmployee(id: string): Observable<void> {
    return this.api.deactivateEmployee(id);
  }

  searchAudit(query: AuditQuery): Observable<Page<AuditLogEntry>> {
    return this.api.searchAudit(query);
  }

  getAuditEntry(id: string): Observable<AuditLogEntry> {
    return this.api.getAuditEntry(id);
  }

  employeeCountByDepartment(employees: readonly Employee[]): Map<string, number> {
    const counts = new Map<string, number>();
    for (const e of employees) {
      if (!e.departmentId) continue;
      counts.set(e.departmentId, (counts.get(e.departmentId) ?? 0) + 1);
    }
    return counts;
  }

  departmentName(departments: readonly Department[], id: string | null): string {
    if (!id) return '';
    return departments.find((d) => d.id === id)?.name ?? '';
  }
}

export function isForbidden(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { status?: number }).status === 403
  );
}

/** Cautious display: backend JSON snapshots truncated, never executed. */
export function truncateSnapshot(value: string | null, limit = 1500): string {
  if (!value) return '';
  return value.length > limit ? `${value.slice(0, limit)}…` : value;
}
