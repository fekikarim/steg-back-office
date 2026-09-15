import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { FinanceQueueComponent } from './finance-queue.component';
import { FinanceQueueStore } from './finance-queue-store';
import { ApiClient } from '../../core/api-client.service';
import { AuthService } from '../../core/auth.service';
import { I18nService } from '../../core/i18n.service';
import type { FinanceCaseQueueItem } from '../../core/api-models';

@Component({ selector: 'st-stub', standalone: true, template: '' })
class StubComponent {}

const PAGE = {
  content: [
    {
      id: 'fc1',
      reference: 'FIN-2026-0001',
      status: 'READY_FOR_DECISION',
      internshipId: 'i1',
      internshipReference: 'STAGE-2026-0001',
      openedAt: '2026-10-01T00:00:00Z',
      closedAt: null,
      receiptReference: null,
    },
    {
      id: 'fc2',
      reference: 'FIN-2026-0002',
      status: 'DOCUMENTS_MISSING',
      internshipId: 'i2',
      internshipReference: 'STAGE-2026-0002',
      openedAt: '2026-09-05T00:00:00Z',
      closedAt: null,
      receiptReference: null,
    },
  ] as FinanceCaseQueueItem[],
  totalElements: 2,
  totalPages: 1,
  number: 0,
  size: 20,
};

describe('FinanceQueueComponent', () => {
  async function setup() {
    const seen: unknown[] = [];
    await TestBed.configureTestingModule({
      imports: [FinanceQueueComponent],
      providers: [
        provideRouter([
          { path: 'dashboard', component: StubComponent },
          { path: 'finance', component: StubComponent },
          { path: 'finance/:id', component: StubComponent },
        ]),
        {
          provide: ApiClient,
          useValue: {
            listFinanceCases: (status: unknown, page: unknown, size: unknown, sort: unknown) => {
              seen.push({ status, page, size, sort });
              return of(PAGE);
            },
            getInternship: (id: unknown) =>
              of(
                id === 'i1'
                  ? { candidateFullName: 'Sara Ben Ammar', requirement: 'OBLIGATOIRE' }
                  : { candidateFullName: 'Omar Trabelsi', requirement: 'OPTIONAL' },
              ),
            listAssignments: (id: unknown) =>
              of(
                id === 'i1'
                  ? [{ status: 'ACTIVE', departmentName: 'DSI' }]
                  : [{ status: 'ACTIVE', departmentName: 'Comptabilité' }],
              ),
          },
        },
      ],
    }).compileComponents();
    TestBed.inject(AuthService).signInDemo('fin@steg.tn', 'FINANCE');
    TestBed.inject(I18nService).setLocale('en');
    const fixture = TestBed.createComponent(FinanceQueueComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    return { fixture, seen };
  }

  it('queries the server with status/page/sort and enriches rows', async () => {
    const { fixture, seen } = await setup();
    expect(seen).toEqual([{ status: '', page: 0, size: 20, sort: 'openedAt,desc' }]);
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('FIN-2026-0001');
    expect(text).toContain('Sara Ben Ammar');
    expect(text).toContain('DSI');
  });

  it('refetches server-side on status change and preserves state', async () => {
    const { fixture, seen } = await setup();
    const component = fixture.componentInstance;
    component.status.set('READY_FOR_DECISION');
    component.onServerFilter();
    expect(seen.length).toBe(2);
    expect(seen[1]).toMatchObject({ status: 'READY_FOR_DECISION', page: 0 });
    expect(TestBed.inject(FinanceQueueStore).get().status).toBe('READY_FOR_DECISION');

    const fixture2 = TestBed.createComponent(FinanceQueueComponent);
    fixture2.detectChanges();
    await fixture2.whenStable();
    expect(fixture2.componentInstance.status()).toBe('READY_FOR_DECISION');
  });

  it('refines the loaded page by eligibility without refetching', async () => {
    const { fixture, seen } = await setup();
    const component = fixture.componentInstance;
    component.eligibility.set('eligible');
    component.onPageFilter();
    fixture.detectChanges();
    expect(seen.length).toBe(1);
    expect(component.filtered().length).toBe(1);
    expect(component.filtered()[0]?.reference).toBe('FIN-2026-0001');
    const text = fixture.nativeElement.textContent as string;
    expect(text).not.toContain('FIN-2026-0002');
  });
});
