import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { InternshipListComponent } from './internship-list.component';
import { InternshipQueueStore } from './internship-queue-store';
import { InternshipService } from './internship.service';
import { ApiClient } from '../../core/api-client.service';
import { AuthService } from '../../core/auth.service';
import { I18nService } from '../../core/i18n.service';
import type { InternshipDetail, InternshipAssignment } from '../../core/api-models';

@Component({ selector: 'st-stub', standalone: true, template: '' })
class StubComponent {}

const ROWS: InternshipDetail[] = [
  {
    id: 'i1',
    reference: 'STAGE-2026-0001',
    startDate: '2026-07-01',
    endDate: '2026-09-30',
    status: 'ACTIVE',
    type: 'PFE',
    requirement: 'OBLIGATOIRE',
    paymentEligible: true,
    subject: 'Grid',
    academicLevel: 'Engineer',
    candidateId: 'c1',
    candidateFullName: 'Sara Ben Ammar',
    applicationId: 'a1',
    createdAt: '2026-06-01T00:00:00Z',
    updatedAt: '2026-06-02T00:00:00Z',
    version: 0,
  },
  {
    id: 'i2',
    reference: 'STAGE-2026-0002',
    startDate: '2026-07-01',
    endDate: '2026-07-31',
    status: 'PLANNED',
    type: 'OBSERVATION',
    requirement: 'OPTIONAL',
    paymentEligible: false,
    subject: 'Discovery',
    academicLevel: 'License',
    candidateId: 'c2',
    candidateFullName: 'Omar Trabelsi',
    applicationId: null,
    createdAt: '2026-06-02T00:00:00Z',
    updatedAt: '2026-06-02T00:00:00Z',
    version: 0,
  },
];

function assignment(name: string, department: string): InternshipAssignment {
  return {
    id: `as-${name}`,
    internshipId: 'i1',
    departmentId: 'd1',
    departmentName: department,
    supervisorId: 's1',
    supervisorName: name,
    assignedById: 'e9',
    assignedByName: 'HR Staff',
    assignedAt: '2026-07-01',
    startDate: null,
    endDate: null,
    status: 'ACTIVE',
    assignmentReason: null,
    endedAt: null,
    createdAt: '2026-07-01T00:00:00Z',
    version: 0,
  };
}

describe('InternshipListComponent', () => {
  async function setup(role: 'HR' | 'SUPERVISOR' = 'HR') {
    localStorage.removeItem('st-mine-supervisor');
    await TestBed.configureTestingModule({
      imports: [InternshipListComponent],
      providers: [
        provideRouter([
          { path: 'dashboard', component: StubComponent },
          { path: 'internships', component: StubComponent },
          { path: 'internships/new', component: StubComponent },
          { path: 'internships/:id', component: StubComponent },
          { path: 'applications', component: StubComponent },
        ]),
        {
          provide: ApiClient,
          useValue: { listInternships: () => of(ROWS) },
        },
        {
          provide: InternshipService,
          useValue: {
            loadAssignmentMap: (ids: string[]) => {
              const map = new Map<string, InternshipAssignment[]>();
              for (const id of ids) {
                map.set(id, id === 'i1' ? [assignment('Leila Mansour', 'DSI')] : []);
              }
              return of(map);
            },
          },
        },
      ],
    }).compileComponents();
    TestBed.inject(AuthService).signInDemo(role === 'HR' ? 'rh@steg.tn' : 'sup@steg.tn', role);
    TestBed.inject(I18nService).setLocale('en');
    const fixture = TestBed.createComponent(InternshipListComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }

  it('renders backend rows with joined current supervisor/department', async () => {
    const fixture = await setup();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('STAGE-2026-0001');
    expect(text).toContain('Leila Mansour');
    expect(text).toContain('DSI');
  });

  it('shows backend-computed type verbatim (no client-side classification)', async () => {
    const fixture = await setup();
    // i2 spans one month yet the backend says OBSERVATION/OPTIONAL — shown as-is.
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('OBSERVATION');
    expect(fixture.componentInstance.filtered().length).toBe(2);
    fixture.componentInstance.type.set('PFE');
    expect(fixture.componentInstance.filtered().length).toBe(1);
    expect(fixture.componentInstance.filtered()[0]?.reference).toBe('STAGE-2026-0001');
  });

  it('filters by supervisor and preserves state across navigation', async () => {
    const fixture = await setup();
    const component = fixture.componentInstance;
    expect(component.supervisorOptions()).toContain('Leila Mansour');
    component.supervisor.set('Leila Mansour');
    component.onFilter();
    expect(component.filtered().length).toBe(1);
    expect(TestBed.inject(InternshipQueueStore).get().supervisor).toBe('Leila Mansour');

    const fixture2 = TestBed.createComponent(InternshipListComponent);
    fixture2.detectChanges();
    await fixture2.whenStable();
    expect(fixture2.componentInstance.supervisor()).toBe('Leila Mansour');
    expect(fixture2.componentInstance.filtered().length).toBe(1);
  });

  it('supervisor view remembers the explicitly chosen name', async () => {
    const fixture = await setup('SUPERVISOR');
    const component = fixture.componentInstance;
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('My interns');
    component.supervisor.set('Leila Mansour');
    component.onSupervisorChange();
    expect(localStorage.getItem('st-mine-supervisor')).toBe('Leila Mansour');

    const fixture2 = TestBed.createComponent(InternshipListComponent);
    fixture2.detectChanges();
    await fixture2.whenStable();
    expect(fixture2.componentInstance.supervisor()).toBe('Leila Mansour');
  });

  it('hides management entry points without INTERNSHIP_ASSIGN', async () => {
    const fixture = await setup('SUPERVISOR');
    expect(fixture.nativeElement.querySelector('a[href="/internships/new"]')).toBeNull();
  });
});
