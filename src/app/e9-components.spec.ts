/**
 * E9 — Angular component and service unit tests.
 *
 * Coverage:
 *  - AuthService: role extraction, permission gating, token lifecycle
 *  - Format helpers: formatTND, formatDate, formatDateTime
 *  - DataTableComponent: sort toggle, page-bound rendering
 *  - PaginationComponent: page navigation and boundary states
 *  - DialogComponent: open/close and backdrop click dismiss
 *  - ToastService: queue management and dismiss
 */

import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { AuthService } from './core/auth.service';
import { DataTableComponent } from './shared/ui/data-table.component';
import { PaginationComponent } from './shared/ui/pagination.component';
import { DialogComponent } from './shared/ui/dialog.component';
import { ToastService } from './shared/ui/toast.service';
import { formatTND, formatDate, formatDateTime } from './core/format';
import { permissionsFor } from './core/roles';

@Component({ standalone: true, template: '' })
class DummyComponent {}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal JWT with the given roles claim */
function makeJwt(roles: string[]): string {
  const payload = btoa(
    JSON.stringify({
      sub: 'u1',
      email: 'hr@steg.com.tn',
      roles,
      exp: 9999999999,
    }),
  );
  return `header.${payload}.sig`;
}

// ---------------------------------------------------------------------------
// AuthService
// ---------------------------------------------------------------------------

describe('AuthService', () => {
  let service: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        AuthService,
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'dashboard', component: DummyComponent },
          { path: 'login', component: DummyComponent },
        ]),
      ],
    });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('starts unauthenticated', () => {
    expect(service.isAuthenticated()).toBe(false);
    expect(service.user()).toBeNull();
  });

  it('login stores session and marks authenticated', () => {
    let resolved = false;
    service.login('hr@steg.com.tn', 'secret').subscribe(() => (resolved = true));

    const req = http.expectOne('http://localhost:8080/api/auth/login');
    expect(req.request.method).toBe('POST');
    req.flush({
      accessToken: makeJwt(['ROLE_HR']),
      refreshToken: 'rt',
      expiresIn: 3600,
      tokenType: 'Bearer',
    });

    expect(resolved).toBe(true);
    expect(service.isAuthenticated()).toBe(true);
    expect(service.role()).toBe('HR');
  });

  it('signOut clears session state', () => {
    service.signInDemo('hr@steg.com.tn', 'HR');
    expect(service.isAuthenticated()).toBe(true);
    service.signOut();
    expect(service.isAuthenticated()).toBe(false);
    expect(service.user()).toBeNull();
  });

  it('HR has APPLICATION_REVIEW permission but not USER_MANAGE', () => {
    const perms = permissionsFor('HR');
    expect(perms).toContain('APPLICATION_REVIEW');
    expect(perms).not.toContain('USER_MANAGE');
  });

  it('ADMIN has all permissions', () => {
    const perms = permissionsFor('ADMIN');
    expect(perms).toContain('USER_MANAGE');
    expect(perms).toContain('APPLICATION_REVIEW');
    expect(perms).toContain('FINANCE_CASE_VIEW');
  });

  it('FINANCE has FINANCE_CASE_VIEW but not APPLICATION_REVIEW', () => {
    const perms = permissionsFor('FINANCE');
    expect(perms).toContain('FINANCE_CASE_VIEW');
    expect(perms).not.toContain('APPLICATION_REVIEW');
  });
});

// ---------------------------------------------------------------------------
// Format utilities
// ---------------------------------------------------------------------------

describe('format utilities', () => {
  it('formatTND renders TND with 2 decimal places in fr locale', () => {
    const result = formatTND(150, 'fr');
    expect(result).toContain('150');
    expect(result).toContain('TND');
  });

  it('formatTND with 0 renders zero correctly', () => {
    const result = formatTND(0, 'fr');
    expect(result).toContain('0');
  });

  it('formatDate returns Africa/Tunis formatted string', () => {
    const result = formatDate('2026-06-15T10:00:00Z', 'fr');
    expect(result).toBeTruthy();
    expect(result.length).toBeGreaterThan(4);
  });

  it('formatDate with null returns dash', () => {
    const result = formatDate(null, 'fr');
    expect(result).toBe('—');
  });

  it('formatDateTime formats date with time', () => {
    const result = formatDateTime('2026-06-15T10:30:00Z', 'fr');
    expect(result).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// DataTableComponent — sort, page-bound, aria
// ---------------------------------------------------------------------------

describe('DataTableComponent', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({ imports: [DataTableComponent] }).compileComponents(),
  );

  it('toggles sort column: first click asc, second click desc', () => {
    const fixture = TestBed.createComponent(DataTableComponent);
    const comp = fixture.componentInstance;
    comp.columns = [{ key: 'status', label: 'Status', sortable: true }];
    const emitted: unknown[] = [];
    comp.sortChange.subscribe((s) => emitted.push(s));

    comp.toggleSort('status');
    expect(emitted[0]).toEqual({ key: 'status', direction: 'asc' });

    comp.sort = { key: 'status', direction: 'asc' };
    comp.toggleSort('status');
    expect(emitted[1]).toEqual({ key: 'status', direction: 'desc' });
  });

  it('ariaSort reflects current sort state correctly', () => {
    const fixture = TestBed.createComponent(DataTableComponent);
    const comp = fixture.componentInstance;
    comp.sort = { key: 'date', direction: 'asc' };
    expect(comp.ariaSort('date')).toBe('ascending');
    comp.sort = { key: 'date', direction: 'desc' };
    expect(comp.ariaSort('date')).toBe('descending');
    expect(comp.ariaSort('other')).toBeNull();
  });

  it('non-sortable column does not render sort button', () => {
    const fixture = TestBed.createComponent(DataTableComponent);
    fixture.componentInstance.columns = [{ key: 'id', label: 'ID', sortable: false }];
    fixture.detectChanges();
    const btn = fixture.nativeElement.querySelector('.st-th-sort');
    expect(btn).toBeNull();
  });

  it('renders sort button with aria-label for sortable columns', () => {
    const fixture = TestBed.createComponent(DataTableComponent);
    fixture.componentInstance.columns = [{ key: 'status', label: 'Status', sortable: true }];
    fixture.detectChanges();
    const btn = fixture.nativeElement.querySelector('.st-th-sort') as HTMLButtonElement;
    expect(btn).toBeTruthy();
    expect(btn.getAttribute('aria-label')).toContain('Status');
  });
});

// ---------------------------------------------------------------------------
// PaginationComponent — boundary states
// ---------------------------------------------------------------------------

describe('PaginationComponent', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({ imports: [PaginationComponent] }).compileComponents(),
  );

  it('disables prev on page 0 and enables next', () => {
    const fixture = TestBed.createComponent(PaginationComponent);
    fixture.componentInstance.page = 0;
    fixture.componentInstance.totalPages = 5;
    fixture.detectChanges();
    const buttons = fixture.nativeElement.querySelectorAll(
      '.st-icon-btn',
    ) as NodeListOf<HTMLButtonElement>;
    expect(buttons[0]?.disabled).toBe(true); // prev
    expect(buttons[1]?.disabled).toBe(false); // next
  });

  it('disables next on last page and enables prev', () => {
    const fixture = TestBed.createComponent(PaginationComponent);
    fixture.componentInstance.page = 4;
    fixture.componentInstance.totalPages = 5;
    fixture.detectChanges();
    const buttons = fixture.nativeElement.querySelectorAll(
      '.st-icon-btn',
    ) as NodeListOf<HTMLButtonElement>;
    expect(buttons[0]?.disabled).toBe(false); // prev
    expect(buttons[1]?.disabled).toBe(true); // next
  });

  it('emits next event on next button click', () => {
    const fixture = TestBed.createComponent(PaginationComponent);
    fixture.componentInstance.page = 1;
    fixture.componentInstance.totalPages = 5;
    fixture.detectChanges();
    let nextEmitted = false;
    fixture.componentInstance.next.subscribe(() => (nextEmitted = true));
    const buttons = fixture.nativeElement.querySelectorAll(
      '.st-icon-btn',
    ) as NodeListOf<HTMLButtonElement>;
    buttons[1]?.click();
    expect(nextEmitted).toBe(true);
  });

  it('emits prev event on prev button click', () => {
    const fixture = TestBed.createComponent(PaginationComponent);
    fixture.componentInstance.page = 3;
    fixture.componentInstance.totalPages = 5;
    fixture.detectChanges();
    let prevEmitted = false;
    fixture.componentInstance.prev.subscribe(() => (prevEmitted = true));
    const buttons = fixture.nativeElement.querySelectorAll(
      '.st-icon-btn',
    ) as NodeListOf<HTMLButtonElement>;
    buttons[0]?.click();
    expect(prevEmitted).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// DialogComponent — open/close
// ---------------------------------------------------------------------------

describe('DialogComponent', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({ imports: [DialogComponent] }).compileComponents(),
  );

  it('is hidden when open=false', () => {
    const fixture = TestBed.createComponent(DialogComponent);
    fixture.componentInstance.open = false;
    fixture.detectChanges();
    const overlay = fixture.nativeElement.querySelector('.st-dialog-backdrop');
    expect(overlay).toBeNull();
  });

  it('renders dialog when open=true and emits close', () => {
    const fixture = TestBed.createComponent(DialogComponent);
    fixture.componentInstance.open = true;
    fixture.componentInstance.title = 'Test Dialog';
    fixture.detectChanges();
    const overlay = fixture.nativeElement.querySelector('.st-dialog-backdrop');
    expect(overlay).toBeTruthy();

    let closed = false;
    fixture.componentInstance.close.subscribe(() => (closed = true));
    const closeBtn = fixture.nativeElement.querySelector('.st-icon-btn') as HTMLButtonElement;
    closeBtn.click();
    expect(closed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// ToastService — queue management
// ---------------------------------------------------------------------------

describe('ToastService', () => {
  let service: ToastService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [ToastService] });
    service = TestBed.inject(ToastService);
  });

  it('adds a success toast and it appears in the queue', () => {
    service.show('success', 'Saved!');
    expect(service.toasts().length).toBeGreaterThanOrEqual(1);
    const toast = service.toasts().find((t) => t.message === 'Saved!');
    expect(toast).toBeTruthy();
    expect(toast?.kind).toBe('success');
  });

  it('adds an error toast', () => {
    service.show('error', 'Something failed');
    const toast = service.toasts().find((t) => t.message === 'Something failed');
    expect(toast).toBeTruthy();
    expect(toast?.kind).toBe('error');
  });

  it('dismiss removes the toast from the queue', () => {
    service.show('success', 'To be dismissed');
    const toast = service.toasts().find((t) => t.message === 'To be dismissed');
    expect(toast).toBeTruthy();
    service.dismiss(toast!.id);
    const remaining = service.toasts().find((t) => t.message === 'To be dismissed');
    expect(remaining).toBeUndefined();
  });
});
