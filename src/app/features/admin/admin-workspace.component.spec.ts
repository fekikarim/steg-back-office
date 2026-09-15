import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AdminWorkspaceComponent } from './admin-workspace.component';
import { AdminService } from './admin.service';
import { AuthService } from '../../core/auth.service';
import { I18nService } from '../../core/i18n.service';
import type { Department, Employee } from '../../core/api-models';

@Component({ selector: 'st-stub', standalone: true, template: '' })
class StubComponent {}

function httpError(status: number): { status: number } {
  return { status };
}

const DEPTS: Department[] = [
  {
    id: 'root',
    code: 'DG',
    name: 'Direction',
    description: null,
    active: true,
    parentDepartmentId: null,
    createdAt: '',
    updatedAt: '',
    version: 0,
  },
  {
    id: 'c1',
    code: 'DSI',
    name: 'DSI',
    description: null,
    active: true,
    parentDepartmentId: 'root',
    createdAt: '',
    updatedAt: '',
    version: 0,
  },
];

const EMPS: Employee[] = [
  {
    id: 'e1',
    employeeNumber: 'EMP-1',
    firstName: 'Leila',
    lastName: 'Mansour',
    phoneNumber: null,
    position: 'Supervisor',
    hireDate: null,
    active: true,
    departmentId: 'c1',
    departmentName: 'DSI',
    userId: 'u-9',
    createdAt: '',
    updatedAt: '',
    version: 0,
  },
];

describe('AdminWorkspaceComponent', () => {
  async function setup() {
    const calls: { method: string; args: unknown[] }[] = [];
    await TestBed.configureTestingModule({
      imports: [AdminWorkspaceComponent],
      providers: [
        provideRouter([
          { path: 'dashboard', component: StubComponent },
          { path: 'admin', component: StubComponent },
        ]),
        {
          provide: AdminService,
          useValue: {
            loadOrganization: () => of({ departments: DEPTS, employees: EMPS }),
            employeeCountByDepartment: () => new Map([['c1', 1]]),
            departmentName: (_ds: unknown, id: unknown) => (id === 'c1' ? 'DSI' : ''),
            createDepartment: (body: unknown) => {
              calls.push({ method: 'createDepartment', args: [body] });
              return of({ id: 'd9' });
            },
            updateDepartment: (id: unknown, body: unknown) => {
              calls.push({ method: 'updateDepartment', args: [id, body] });
              return of({ id });
            },
            deactivateDepartment: (id: unknown) => {
              calls.push({ method: 'deactivateDepartment', args: [id] });
              return of(undefined);
            },
            createEmployee: (body: unknown) => {
              calls.push({ method: 'createEmployee', args: [body] });
              return of({ id: 'e9' });
            },
            updateEmployee: () => of({}),
            deactivateEmployee: (id: unknown) => {
              calls.push({ method: 'deactivateEmployee', args: [id] });
              return of(undefined);
            },
          },
        },
      ],
    }).compileComponents();
    TestBed.inject(AuthService).signInDemo('admin@steg.tn', 'ADMIN');
    TestBed.inject(I18nService).setLocale('en');
    const fixture = TestBed.createComponent(AdminWorkspaceComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    return { fixture, calls };
  }

  it('renders the department hierarchy with depth and staff counts', async () => {
    const { fixture } = await setup();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Direction');
    expect(text).toContain('DSI');
    const items = fixture.nativeElement.querySelectorAll('[role="treeitem"]');
    expect(items.length).toBe(2);
    expect(items[1]?.getAttribute('aria-level')).toBe('2');
  });

  it('creates departments with trimmed payloads', async () => {
    const { fixture, calls } = await setup();
    const component = fixture.componentInstance;
    component.openDeptDialog(null);
    component.deptForm.code = '  FIN  ';
    component.deptForm.name = 'Finance';
    component.saveDept();
    expect(calls).toEqual([
      {
        method: 'createDepartment',
        args: [{ code: 'FIN', name: 'Finance', parentDepartmentId: null }],
      },
    ]);
  });

  it('excludes the edited node and its descendants from parent options', async () => {
    const { fixture } = await setup();
    const component = fixture.componentInstance;
    const root = DEPTS[0];
    if (!root) throw new Error('fixture');
    component.openDeptDialog(root);
    const ids = component.parentOptions().map((n) => n.department.id);
    expect(ids).not.toContain('root');
    expect(ids).not.toContain('c1');
  });

  it('confirms deactivation with an explicit consequence before calling', async () => {
    const { fixture, calls } = await setup();
    const component = fixture.componentInstance;
    const root = DEPTS[0];
    if (!root) throw new Error('fixture');
    component.askDeactivateDept(root);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('soft-delete');
    component.doDeactivate();
    expect(calls).toEqual([{ method: 'deactivateDepartment', args: ['root'] }]);
  });

  it('rejects malformed userIds without calling the backend', async () => {
    const { fixture, calls } = await setup();
    const component = fixture.componentInstance;
    component.tab.set('employees');
    fixture.detectChanges();
    component.openEmpDialog(null);
    component.empForm.employeeNumber = 'EMP-2';
    component.empForm.firstName = 'A';
    component.empForm.lastName = 'B';
    component.empForm.departmentId = 'c1';
    component.empForm.userId = 'not-a-uuid';
    component.saveEmp();
    expect(component.empError()).toBeTruthy();
    expect(calls.some((c) => c.method === 'createEmployee')).toBe(false);
  });

  it('shows user linkage badges and an honest pending accounts panel', async () => {
    const { fixture } = await setup();
    const component = fixture.componentInstance;
    component.tab.set('employees');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent as string).toContain('Linked');
    component.tab.set('accounts');
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('backend endpoint pending');
    // No account actions exist anywhere on the pending panel.
    const buttons = [...fixture.nativeElement.querySelectorAll('section button')];
    expect(buttons.length).toBe(0);
  });

  it('surfaces backend 403 on load as a forbidden-style message, not a crash', async () => {
    await TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [AdminWorkspaceComponent],
      providers: [
        provideRouter([
          { path: 'dashboard', component: StubComponent },
          { path: 'admin', component: StubComponent },
        ]),
        {
          provide: AdminService,
          useValue: { loadOrganization: () => throwError(() => httpError(403)) },
        },
      ],
    }).compileComponents();
    TestBed.inject(AuthService).signInDemo('dir@steg.tn', 'DIRECTOR');
    TestBed.inject(I18nService).setLocale('en');
    const fixture = TestBed.createComponent(AdminWorkspaceComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('st-error-state')).toBeTruthy();
  });
});
