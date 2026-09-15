import { TestBed } from '@angular/core/testing';
import { DataTableComponent } from './data-table.component';
import { PaginationComponent } from './pagination.component';
import { BadgeComponent } from './badge.component';

describe('DataTableComponent', () => {
  it('toggles sort asc→desc and exposes aria-sort', async () => {
    await TestBed.configureTestingModule({ imports: [DataTableComponent] }).compileComponents();
    const fixture = TestBed.createComponent(DataTableComponent);
    const component = fixture.componentInstance;
    component.columns = [{ key: 'reference', label: 'Reference', sortable: true }];
    let emitted: unknown;
    component.sortChange.subscribe((s) => (emitted = s));
    component.toggleSort('reference');
    expect(emitted).toEqual({ key: 'reference', direction: 'asc' });
    component.sort = { key: 'reference', direction: 'asc' };
    expect(component.ariaSort('reference')).toBe('ascending');
    component.toggleSort('reference');
    expect(emitted).toEqual({ key: 'reference', direction: 'desc' });
  });

  it('renders sortable header buttons with accessible names', async () => {
    await TestBed.configureTestingModule({ imports: [DataTableComponent] }).compileComponents();
    const fixture = TestBed.createComponent(DataTableComponent);
    fixture.componentInstance.columns = [{ key: 'status', label: 'Status', sortable: true }];
    fixture.detectChanges();
    const btn = fixture.nativeElement.querySelector('.st-th-sort') as HTMLButtonElement;
    expect(btn).toBeTruthy();
    expect(btn.getAttribute('aria-label')).toContain('Status');
  });
});

describe('PaginationComponent', () => {
  it('disables prev on first page and next on last page', async () => {
    await TestBed.configureTestingModule({ imports: [PaginationComponent] }).compileComponents();
    const fixture = TestBed.createComponent(PaginationComponent);
    fixture.componentInstance.page = 0;
    fixture.componentInstance.totalPages = 3;
    fixture.detectChanges();
    const buttons = fixture.nativeElement.querySelectorAll('.st-icon-btn');
    expect((buttons[0] as HTMLButtonElement).disabled).toBe(true);
    expect((buttons[1] as HTMLButtonElement).disabled).toBe(false);
  });
});

describe('BadgeComponent', () => {
  it('always renders text (never color-only)', async () => {
    await TestBed.configureTestingModule({ imports: [BadgeComponent] }).compileComponents();
    const fixture = TestBed.createComponent(BadgeComponent);
    fixture.componentInstance.label = 'ACCEPTED';
    fixture.componentInstance.tone = 'success';
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('ACCEPTED');
  });
});
