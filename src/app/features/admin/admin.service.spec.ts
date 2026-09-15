import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { AdminService, buildDepartmentTree, flattenTree, truncateSnapshot } from './admin.service';
import { ApiClient } from '../../core/api-client.service';
import type { Department } from '../../core/api-models';

function httpError(status: number): { status: number } {
  return { status };
}

function dept(id: string, name: string, parent: string | null = null): Department {
  return {
    id,
    code: id.toUpperCase(),
    name,
    description: null,
    active: true,
    parentDepartmentId: parent,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    version: 0,
  };
}

describe('buildDepartmentTree', () => {
  it('nests children under parents with depth, sorted by name', () => {
    const tree = buildDepartmentTree([
      dept('c2', 'Zeta', 'root'),
      dept('c1', 'Alpha', 'root'),
      dept('root', 'Root', null),
    ]);
    expect(tree.length).toBe(1);
    expect(tree[0]?.department.id).toBe('root');
    expect(tree[0]?.children.map((c) => c.department.id)).toEqual(['c1', 'c2']);
    expect(tree[0]?.children[0]?.depth).toBe(1);
  });

  it('treats orphans and self-parents as roots', () => {
    const tree = buildDepartmentTree([dept('o1', 'Orphan', 'missing'), dept('s1', 'Self', 's1')]);
    expect(tree.map((n) => n.department.id).sort()).toEqual(['o1', 's1']);
  });

  it('cuts cycles instead of hanging', () => {
    const tree = buildDepartmentTree([dept('a', 'A', 'b'), dept('b', 'B', 'a')]);
    // Neither is a root; both reference each other — cycle cut keeps output finite.
    expect(JSON.stringify(tree).length).toBeLessThan(10000);
  });

  it('flattens depth-first', () => {
    const tree = buildDepartmentTree([dept('c1', 'C', 'root'), dept('root', 'Root', null)]);
    expect(flattenTree(tree).map((n) => n.department.id)).toEqual(['root', 'c1']);
  });
});

describe('truncateSnapshot', () => {
  it('passes short values through and truncates long ones', () => {
    expect(truncateSnapshot(null)).toBe('');
    expect(truncateSnapshot('{"a":1}')).toBe('{"a":1}');
    const long = 'x'.repeat(2000);
    const out = truncateSnapshot(long, 100);
    expect(out.length).toBeLessThan(long.length);
    expect(out.endsWith('…')).toBe(true);
  });
});

describe('AdminService', () => {
  function setup(stub: Partial<Record<string, (...args: never[]) => unknown>>): AdminService {
    TestBed.configureTestingModule({
      providers: [
        AdminService,
        {
          provide: ApiClient,
          useValue: {
            listDepartments: () => of([]),
            listEmployees: () => of([]),
            createDepartment: () => of({}),
            updateDepartment: () => of({}),
            deactivateDepartment: () => of(undefined),
            createEmployee: () => of({}),
            updateEmployee: () => of({}),
            deactivateEmployee: () => of(undefined),
            searchAudit: () => of({ content: [] }),
            getAuditEntry: () => of({}),
            ...stub,
          },
        },
      ],
    });
    return TestBed.inject(AdminService);
  }

  it('loads organization with per-list failure isolation', () => {
    const service = setup({ listEmployees: () => throwError(() => httpError(403)) });
    let result!: { departments: unknown[]; employees: unknown[] };
    service.loadOrganization().subscribe((r) => (result = r));
    expect(result.employees).toEqual([]);
  });

  it('counts employees per department for the tree badges', () => {
    const service = setup({});
    const counts = service.employeeCountByDepartment([
      { departmentId: 'd1' },
      { departmentId: 'd1' },
      { departmentId: null },
    ] as unknown as Parameters<AdminService['employeeCountByDepartment']>[0]);
    expect(counts.get('d1')).toBe(2);
  });
});
