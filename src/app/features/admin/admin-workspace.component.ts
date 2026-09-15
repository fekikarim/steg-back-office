import { Component, inject, signal, computed, OnInit, OnDestroy, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { I18nService } from '../../core/i18n.service';
import { RealtimeService } from '../../core/realtime.service';
import { BreadcrumbService } from '../../core/breadcrumb.service';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../shared/ui/toast.service';
import {
  AdminService,
  buildDepartmentTree,
  flattenTree,
  isForbidden,
  type DepartmentNode,
} from './admin.service';
import { ALL_ROLES, permissionsFor } from '../../core/roles';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { LiveStatusComponent } from '../../shared/ui/live-status.component';
import { BadgeComponent, type BadgeTone } from '../../shared/ui/badge.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { EmptyStateComponent, ErrorStateComponent } from '../../shared/ui/states.component';
import { AlertComponent } from '../../shared/ui/alert.component';
import { TabsComponent } from '../../shared/ui/tabs.component';
import { DialogComponent, ConfirmDialogComponent } from '../../shared/ui/dialog.component';
import { DataTableComponent } from '../../shared/ui/data-table.component';
import { StIconComponent } from '../../shared/ui/icon.component';
import type { Department, Employee } from '../../core/api-models';

type TabId = 'departments' | 'employees' | 'accounts';

/**
 * Restricted administration workspace (ADMIN only via USER_MANAGE).
 * Departments (tree + CRUD, deactivation is soft-delete) and employees
 * (CRUD + userId linkage) follow backend permissions exactly. User-account
 * provisioning has no backend endpoint, so the Accounts tab is an honest
 * pending panel — no account actions are faked.
 */
@Component({
  selector: 'st-admin-workspace',
  standalone: true,
  imports: [
    FormsModule,
    LiveStatusComponent,
    PageHeaderComponent,
    BadgeComponent,
    SkeletonComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    AlertComponent,
    TabsComponent,
    DialogComponent,
    ConfirmDialogComponent,
    DataTableComponent,
    StIconComponent,
  ],
  template: `
    <st-page-header [title]="i18n.t('admin.title')" [subtitle]="i18n.t('admin.subtitle')">
      <st-live-status />
    </st-page-header>

    <st-tabs
      [tabs]="tabItems()"
      [activeId]="tab()"
      label="Administration"
      (select)="onTab($event)"
    />

    @if (loading()) {
      <st-skeleton [rows]="8" />
    } @else if (error()) {
      <st-error-state
        [title]="i18n.t('common.error.title')"
        [body]="errorMessage() || i18n.t('common.error.body')"
        [retryLabel]="i18n.t('common.retry')"
        (retry)="load()"
      />
    } @else {
      @if (tab() === 'departments') {
        <section class="st-card" [attr.aria-label]="i18n.t('admin.departmentsTitle')">
          <div class="st-card__head">
            <h2 class="st-card__title">{{ i18n.t('admin.departmentsTitle') }}</h2>
            <button type="button" class="st-btn st-btn--primary" (click)="openDeptDialog(null)">
              <st-icon name="plus" [size]="15" /> {{ i18n.t('admin.newDepartment') }}
            </button>
          </div>
          @if (flatNodes().length === 0) {
            <st-empty-state
              [title]="i18n.t('common.empty.title')"
              [body]="i18n.t('admin.noDepartments')"
            />
          } @else {
            <ul class="st-tree" role="tree" [attr.aria-label]="i18n.t('admin.departmentsTitle')">
              @for (node of flatNodes(); track node.department.id; let i = $index) {
                <li
                  role="treeitem"
                  [attr.aria-level]="node.depth + 1"
                  [attr.aria-setsize]="flatNodes().length"
                  [attr.aria-posinset]="i + 1"
                >
                  <div class="st-tree__row" [style.--depth]="node.depth">
                    <span class="st-tree__indent" aria-hidden="true"></span>
                    <span class="st-tree__name" dir="auto">
                      <strong>{{ node.department.name }}</strong>
                      <small dir="ltr">{{ node.department.code }}</small>
                    </span>
                    <st-badge
                      [label]="
                        node.department.active ? i18n.t('common.active') : i18n.t('common.inactive')
                      "
                      [tone]="node.department.active ? 'success' : 'neutral'"
                    />
                    <st-badge
                      [label]="
                        i18n.t('admin.staffCount', { count: staffCount(node.department.id) })
                      "
                      tone="neutral"
                    />
                    <span class="st-tree__actions">
                      <button
                        type="button"
                        class="st-btn st-btn--text"
                        (click)="openDeptDialog(node.department)"
                      >
                        {{ i18n.t('common.edit') }}
                      </button>
                      @if (node.department.active) {
                        <button
                          type="button"
                          class="st-btn st-btn--text st-btn--danger-text"
                          (click)="askDeactivateDept(node.department)"
                        >
                          {{ i18n.t('common.deactivate') }}
                        </button>
                      }
                    </span>
                  </div>
                </li>
              }
            </ul>
          }
        </section>
      }

      @if (tab() === 'employees') {
        <section class="st-card" [attr.aria-label]="i18n.t('admin.employeesTitle')">
          <div class="st-card__head">
            <h2 class="st-card__title">{{ i18n.t('admin.employeesTitle') }}</h2>
            <button type="button" class="st-btn st-btn--primary" (click)="openEmpDialog(null)">
              <st-icon name="plus" [size]="15" /> {{ i18n.t('admin.newEmployee') }}
            </button>
          </div>
          <label class="st-field st-field--inline">
            <span class="st-field__label">{{ i18n.t('table.search') }}</span>
            <input
              type="search"
              class="st-input"
              [(ngModel)]="empSearch"
              [placeholder]="i18n.t('admin.empSearchPlaceholder')"
              dir="auto"
            />
          </label>
          @if (filteredEmployees().length === 0) {
            <st-empty-state
              [title]="i18n.t('common.empty.title')"
              [body]="i18n.t('admin.noEmployees')"
            />
          } @else {
            <st-data-table [columns]="empColumns" [hasActions]="true">
              @for (e of filteredEmployees(); track e.id) {
                <tr [class.st-row--inactive]="!e.active">
                  <td dir="ltr">{{ e.employeeNumber }}</td>
                  <td dir="auto">{{ e.firstName }} {{ e.lastName }}</td>
                  <td dir="auto" data-priority="medium">{{ e.position || '—' }}</td>
                  <td dir="auto" data-priority="medium">{{ deptName(e.departmentId) }}</td>
                  <td data-priority="low">
                    @if (e.userId) {
                      <st-badge [label]="i18n.t('admin.linked')" tone="success" icon="link" />
                    } @else {
                      <st-badge [label]="i18n.t('admin.unlinked')" tone="neutral" />
                    }
                  </td>
                  <td data-priority="low">
                    <st-badge
                      [label]="e.active ? i18n.t('common.active') : i18n.t('common.inactive')"
                      [tone]="e.active ? 'success' : 'neutral'"
                    />
                  </td>
                  <td>
                    <button type="button" class="st-btn st-btn--text" (click)="openEmpDialog(e)">
                      {{ i18n.t('common.edit') }}
                    </button>
                    @if (e.active) {
                      <button
                        type="button"
                        class="st-btn st-btn--text st-btn--danger-text"
                        (click)="askDeactivateEmp(e)"
                      >
                        {{ i18n.t('common.deactivate') }}
                      </button>
                    }
                  </td>
                </tr>
              }
            </st-data-table>
          }
        </section>
      }

      @if (tab() === 'accounts') {
        <section class="st-card" [attr.aria-label]="i18n.t('admin.accountsTitle')">
          <h2 class="st-card__title">{{ i18n.t('admin.accountsTitle') }}</h2>
          <st-alert tone="warning" [title]="i18n.t('admin.accountsPendingTitle')">
            {{ i18n.t('admin.accountsPendingBody') }}
          </st-alert>
          <p class="st-hint">{{ i18n.t('admin.accountsScopeHint') }}</p>
          <h3 class="st-sub">{{ i18n.t('admin.roleCatalogueTitle') }}</h3>
          <p class="st-hint">{{ i18n.t('admin.roleCatalogueHint') }}</p>
          <ul class="st-roles">
            @for (role of roles(); track role) {
              <li class="st-role">
                <strong>{{ role }}</strong>
                <span class="st-role__perms" dir="ltr">{{ permsOf(role).join(', ') }}</span>
              </li>
            }
          </ul>
        </section>
      }
    }

    <!-- Department dialog -->
    <st-dialog
      [open]="deptDialog() !== null"
      [title]="deptDialogTitle()"
      (close)="closeDeptDialog()"
    >
      <div class="st-grid2">
        <label class="st-field">
          <span class="st-field__label">{{ i18n.t('admin.code') }} *</span>
          <input class="st-input" [(ngModel)]="deptForm.code" dir="ltr" maxlength="50" />
        </label>
        <label class="st-field">
          <span class="st-field__label">{{ i18n.t('admin.name') }} *</span>
          <input class="st-input" [(ngModel)]="deptForm.name" dir="auto" />
        </label>
      </div>
      <label class="st-field">
        <span class="st-field__label">{{ i18n.t('admin.description') }}</span>
        <textarea
          class="st-input"
          rows="2"
          [(ngModel)]="deptForm.description"
          dir="auto"
        ></textarea>
      </label>
      <label class="st-field">
        <span class="st-field__label">{{ i18n.t('admin.parent') }}</span>
        <select class="st-input" [(ngModel)]="deptForm.parentDepartmentId">
          <option value="">{{ i18n.t('admin.topLevel') }}</option>
          @for (n of parentOptions(); track n.department.id) {
            <option [value]="n.department.id">
              {{ indent(n.depth) }}{{ n.department.name }} ({{ n.department.code }})
            </option>
          }
        </select>
      </label>
      @if (deptError()) {
        <st-alert tone="error">{{ deptError() }}</st-alert>
      }
      <div slot="footer" class="st-dialog__actions">
        <button type="button" class="st-btn st-btn--secondary" (click)="closeDeptDialog()">
          {{ i18n.t('common.cancel') }}
        </button>
        <button
          type="button"
          class="st-btn st-btn--primary"
          [disabled]="busy() || !deptForm.code.trim() || !deptForm.name.trim()"
          (click)="saveDept()"
        >
          {{ i18n.t('common.save') }}
        </button>
      </div>
    </st-dialog>

    <!-- Employee dialog -->
    <st-dialog [open]="empDialog() !== null" [title]="empDialogTitle()" (close)="closeEmpDialog()">
      <div class="st-grid2">
        <label class="st-field">
          <span class="st-field__label">{{ i18n.t('admin.employeeNumber') }} *</span>
          <input class="st-input" [(ngModel)]="empForm.employeeNumber" dir="ltr" maxlength="50" />
        </label>
        <label class="st-field">
          <span class="st-field__label">{{ i18n.t('admin.position') }}</span>
          <input class="st-input" [(ngModel)]="empForm.position" dir="auto" maxlength="100" />
        </label>
        <label class="st-field">
          <span class="st-field__label">{{ i18n.t('admin.firstName') }} *</span>
          <input class="st-input" [(ngModel)]="empForm.firstName" dir="auto" maxlength="100" />
        </label>
        <label class="st-field">
          <span class="st-field__label">{{ i18n.t('admin.lastName') }} *</span>
          <input class="st-input" [(ngModel)]="empForm.lastName" dir="auto" maxlength="100" />
        </label>
        <label class="st-field">
          <span class="st-field__label">{{ i18n.t('admin.phone') }}</span>
          <input class="st-input" [(ngModel)]="empForm.phoneNumber" dir="ltr" maxlength="50" />
        </label>
        <label class="st-field">
          <span class="st-field__label">{{ i18n.t('admin.hireDate') }}</span>
          <input type="date" class="st-input" [(ngModel)]="empForm.hireDate" />
        </label>
        <label class="st-field">
          <span class="st-field__label">{{ i18n.t('admin.department') }} *</span>
          <select class="st-input" [(ngModel)]="empForm.departmentId">
            <option value="">—</option>
            @for (d of departments(); track d.id) {
              <option [value]="d.id">{{ d.name }} ({{ d.code }})</option>
            }
          </select>
        </label>
        <label class="st-field">
          <span class="st-field__label">{{ i18n.t('admin.userId') }}</span>
          <input
            class="st-input"
            [(ngModel)]="empForm.userId"
            dir="ltr"
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          />
        </label>
      </div>
      <p class="st-hint">{{ i18n.t('admin.userIdHint') }}</p>
      @if (empError()) {
        <st-alert tone="error">{{ empError() }}</st-alert>
      }
      <div slot="footer" class="st-dialog__actions">
        <button type="button" class="st-btn st-btn--secondary" (click)="closeEmpDialog()">
          {{ i18n.t('common.cancel') }}
        </button>
        <button
          type="button"
          class="st-btn st-btn--primary"
          [disabled]="
            busy() ||
            !empForm.employeeNumber.trim() ||
            !empForm.firstName.trim() ||
            !empForm.lastName.trim() ||
            !empForm.departmentId
          "
          (click)="saveEmp()"
        >
          {{ i18n.t('common.save') }}
        </button>
      </div>
    </st-dialog>

    <st-confirm-dialog
      [open]="confirmDeactivate() !== null"
      [title]="i18n.t('admin.deactivateTitle')"
      [body]="confirmDeactivateBody()"
      [consequence]="i18n.t('admin.deactivateConsequence')"
      [confirmLabel]="i18n.t('common.deactivate')"
      [cancelLabel]="i18n.t('common.cancel')"
      [busy]="busy()"
      (confirmed)="doDeactivate()"
      (cancel)="confirmDeactivate.set(null)"
    />
  `,
  styles: [
    `
      .st-card {
        background: var(--bg-surface);
        border: 1px solid var(--border-subtle);
        border-radius: 0.7rem;
        padding: 1rem;
        margin-block-start: 0.8rem;
        display: grid;
        gap: 0.6rem;
      }
      .st-card__head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 0.5rem;
        flex-wrap: wrap;
      }
      .st-card__title {
        margin: 0;
        font-size: 0.95rem;
      }
      .st-sub {
        font-size: 0.85rem;
        margin: 0.4rem 0 0;
      }
      .st-hint {
        font-size: 0.78rem;
        color: var(--text-secondary);
        margin: 0;
      }
      .st-grid2 {
        display: grid;
        gap: 0.6rem;
        grid-template-columns: 1fr 1fr;
      }
      .st-tree,
      .st-tree ul {
        list-style: none;
        margin: 0;
        padding: 0;
      }
      .st-tree ul {
        padding-inline-start: 0;
      }
      .st-tree__row {
        display: flex;
        gap: 0.5rem;
        align-items: center;
        flex-wrap: wrap;
        padding: 0.55rem 0.6rem;
        border: 1px solid var(--border-subtle);
        border-radius: 0.55rem;
        margin-block-end: 0.35rem;
      }
      .st-tree__indent {
        flex: none;
        inline-size: calc(var(--depth, 0) * 1.4rem);
      }
      .st-tree__name {
        flex: 1;
        min-inline-size: 10rem;
        display: flex;
        gap: 0.45rem;
        align-items: baseline;
        font-size: 0.86rem;
      }
      .st-tree__name small {
        color: var(--text-muted);
      }
      .st-tree__actions {
        display: flex;
        gap: 0.2rem;
      }
      .st-field--inline {
        max-inline-size: 22rem;
      }
      .st-row--inactive td {
        opacity: 0.62;
      }
      .st-roles {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 0.5rem;
      }
      .st-role {
        border: 1px solid var(--border-subtle);
        border-radius: 0.55rem;
        padding: 0.55rem 0.7rem;
        display: grid;
        gap: 0.2rem;
        font-size: 0.84rem;
      }
      .st-role__perms {
        font-size: 0.75rem;
        color: var(--text-muted);
        overflow-wrap: anywhere;
      }
      .st-dialog__actions {
        display: flex;
        gap: 0.5rem;
        justify-content: flex-end;
      }
      .st-btn--danger-text {
        color: var(--action-danger);
      }
      .st-btn--danger-text {
        color: var(--action-danger);
      }
      @media (max-width: 700px) {
        .st-grid2 {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class AdminWorkspaceComponent implements OnInit, OnDestroy {
  readonly i18n = inject(I18nService);
  readonly auth = inject(AuthService);
  private readonly crumbs = inject(BreadcrumbService);
  private readonly realtime = inject(RealtimeService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly service = inject(AdminService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal(false);
  readonly errorMessage = signal('');
  readonly tab = signal<'departments' | 'employees' | 'accounts'>('departments');

  readonly departments = signal<readonly Department[]>([]);
  readonly employees = signal<readonly Employee[]>([]);
  readonly tree = computed(() => buildDepartmentTree(this.departments()));
  readonly flatNodes = computed(() => flattenTree(this.tree()));
  readonly empSearch = signal('');
  readonly filteredEmployees = computed(() => {
    const q = this.empSearch().trim().toLowerCase();
    const rows = [...this.employees()];
    if (!q) return rows;
    return rows.filter((e) =>
      `${e.firstName} ${e.lastName} ${e.employeeNumber} ${e.position ?? ''}`
        .toLowerCase()
        .includes(q),
    );
  });

  readonly empColumns = [
    { key: 'employeeNumber', label: 'Number' },
    { key: 'name', label: 'Name' },
    { key: 'position', label: 'Position' },
    { key: 'department', label: 'Department' },
    { key: 'user', label: 'Account' },
    { key: 'active', label: 'Status' },
  ];

  readonly deptDialog = signal<Department | 'new' | null>(null);
  readonly deptError = signal('');
  readonly deptForm = { code: '', name: '', description: '', parentDepartmentId: '' };

  readonly empDialog = signal<Employee | 'new' | null>(null);
  readonly empError = signal('');
  readonly empForm = {
    employeeNumber: '',
    firstName: '',
    lastName: '',
    phoneNumber: '',
    position: '',
    hireDate: '',
    departmentId: '',
    userId: '',
  };

  readonly confirmDeactivate = signal<{
    kind: 'department' | 'employee';
    id: string;
    label: string;
  } | null>(null);

  readonly roles = signal(ALL_ROLES);

  tabItems(): { id: string; label: string }[] {
    return [
      { id: 'departments', label: this.i18n.t('admin.tabDepartments') },
      { id: 'employees', label: this.i18n.t('admin.tabEmployees') },
      { id: 'accounts', label: this.i18n.t('admin.tabAccounts') },
    ];
  }

  onTab(id: string): void {
    if (id === 'departments' || id === 'employees' || id === 'accounts') this.tab.set(id);
  }

  permsOf(role: string): string[] {
    return [...permissionsFor(role as (typeof ALL_ROLES)[number])];
  }

  staffCount(departmentId: string): number {
    return this.service.employeeCountByDepartment(this.employees()).get(departmentId) ?? 0;
  }

  deptName(id: string | null): string {
    return this.service.departmentName(this.departments(), id) || '—';
  }

  parentOptions(): DepartmentNode[] {
    const editing = this.deptDialog();
    const exclude = new Set<string>();
    if (editing && editing !== 'new') {
      exclude.add(editing.id);
      for (const n of flattenTree(this.tree())) {
        if (isDescendant(n, editing.id, this.tree())) exclude.add(n.department.id);
      }
    }
    return flattenTree(this.tree()).filter((n) => !exclude.has(n.department.id));
  }

  indent(depth: number): string {
    return '—'.repeat(depth) + (depth > 0 ? ' ' : '');
  }

  ngOnDestroy(): void {}

  ngOnInit(): void {
    this.crumbs.set([{ labelKey: 'nav.admin', labelFallback: 'Administration' }]);
    this.load();
    this.realtime.backofficeEvents$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((e) => {
      if (e.type === 'department' || e.type === 'employee') this.load();
    });
  }

  load(): void {
    this.loading.set(true);
    this.error.set(false);
    this.errorMessage.set('');
    this.service.loadOrganization().subscribe({
      next: ({ departments, employees }) => {
        this.departments.set(departments);
        this.employees.set(employees);
        this.loading.set(false);
      },
      error: (e: unknown) => {
        this.error.set(true);
        this.errorMessage.set(extractMessage(e));
        this.loading.set(false);
      },
    });
  }

  /* ---------------- departments ---------------- */

  openDeptDialog(dept: Department | null): void {
    this.deptDialog.set(dept ?? 'new');
    this.deptForm.code = dept?.code ?? '';
    this.deptForm.name = dept?.name ?? '';
    this.deptForm.description = dept?.description ?? '';
    this.deptForm.parentDepartmentId = dept?.parentDepartmentId ?? '';
    this.deptError.set('');
  }

  closeDeptDialog(): void {
    this.deptDialog.set(null);
    this.deptError.set('');
  }

  deptDialogTitle(): string {
    return this.deptDialog() === 'new'
      ? this.i18n.t('admin.newDepartment')
      : this.i18n.t('admin.editDepartment');
  }

  saveDept(): void {
    const editing = this.deptDialog();
    if (!editing || !this.deptForm.code.trim() || !this.deptForm.name.trim()) return;
    this.busy.set(true);
    const body = {
      code: this.deptForm.code.trim(),
      name: this.deptForm.name.trim(),
      ...(this.deptForm.description.trim()
        ? { description: this.deptForm.description.trim() }
        : {}),
      ...(this.deptForm.parentDepartmentId
        ? { parentDepartmentId: this.deptForm.parentDepartmentId }
        : { parentDepartmentId: null }),
    };
    const done = (): void => {
      this.busy.set(false);
      this.closeDeptDialog();
      this.toast.show('success', this.i18n.t('admin.saved'));
      this.load();
    };
    const fail = (e: unknown): void => {
      this.busy.set(false);
      this.deptError.set(actionErrorMessage(e, this.i18n));
    };
    if (editing === 'new')
      this.service.createDepartment(body).subscribe({ next: done, error: fail });
    else this.service.updateDepartment(editing.id, body).subscribe({ next: done, error: fail });
  }

  askDeactivateDept(dept: Department): void {
    this.confirmDeactivate.set({
      kind: 'department',
      id: dept.id,
      label: `${dept.name} (${dept.code})`,
    });
  }

  /* ---------------- employees ---------------- */

  openEmpDialog(emp: Employee | null): void {
    this.empDialog.set(emp ?? 'new');
    this.empForm.employeeNumber = emp?.employeeNumber ?? '';
    this.empForm.firstName = emp?.firstName ?? '';
    this.empForm.lastName = emp?.lastName ?? '';
    this.empForm.phoneNumber = emp?.phoneNumber ?? '';
    this.empForm.position = emp?.position ?? '';
    this.empForm.hireDate = emp?.hireDate ?? '';
    this.empForm.departmentId = emp?.departmentId ?? '';
    this.empForm.userId = emp?.userId ?? '';
    this.empError.set('');
  }

  closeEmpDialog(): void {
    this.empDialog.set(null);
    this.empError.set('');
  }

  empDialogTitle(): string {
    return this.empDialog() === 'new'
      ? this.i18n.t('admin.newEmployee')
      : this.i18n.t('admin.editEmployee');
  }

  saveEmp(): void {
    const editing = this.empDialog();
    if (
      !editing ||
      !this.empForm.employeeNumber.trim() ||
      !this.empForm.firstName.trim() ||
      !this.empForm.lastName.trim() ||
      !this.empForm.departmentId
    ) {
      return;
    }
    const userId = this.empForm.userId.trim();
    if (userId && !isUuid(userId)) {
      this.empError.set(this.i18n.t('admin.userIdInvalid'));
      return;
    }
    this.busy.set(true);
    const body = {
      employeeNumber: this.empForm.employeeNumber.trim(),
      firstName: this.empForm.firstName.trim(),
      lastName: this.empForm.lastName.trim(),
      ...(this.empForm.phoneNumber.trim() ? { phoneNumber: this.empForm.phoneNumber.trim() } : {}),
      ...(this.empForm.position.trim() ? { position: this.empForm.position.trim() } : {}),
      ...(this.empForm.hireDate ? { hireDate: this.empForm.hireDate } : {}),
      departmentId: this.empForm.departmentId,
      ...(userId ? { userId } : { userId: null }),
    };
    const done = (): void => {
      this.busy.set(false);
      this.closeEmpDialog();
      this.toast.show('success', this.i18n.t('admin.saved'));
      this.load();
    };
    const fail = (e: unknown): void => {
      this.busy.set(false);
      this.empError.set(actionErrorMessage(e, this.i18n));
    };
    if (editing === 'new') this.service.createEmployee(body).subscribe({ next: done, error: fail });
    else this.service.updateEmployee(editing.id, body).subscribe({ next: done, error: fail });
  }

  askDeactivateEmp(emp: Employee): void {
    this.confirmDeactivate.set({
      kind: 'employee',
      id: emp.id,
      label: `${emp.firstName} ${emp.lastName} (${emp.employeeNumber})`,
    });
  }

  confirmDeactivateBody(): string {
    return this.i18n.t('admin.deactivateBody', { label: this.confirmDeactivate()?.label ?? '' });
  }

  doDeactivate(): void {
    const target = this.confirmDeactivate();
    if (!target) return;
    this.busy.set(true);
    const done = (): void => {
      this.busy.set(false);
      this.confirmDeactivate.set(null);
      this.toast.show('success', this.i18n.t('admin.deactivated'));
      this.load();
    };
    const fail = (e: unknown): void => {
      this.busy.set(false);
      this.confirmDeactivate.set(null);
      this.toast.show('error', actionErrorMessage(e, this.i18n));
    };
    if (target.kind === 'department')
      this.service.deactivateDepartment(target.id).subscribe({ next: done, error: fail });
    else this.service.deactivateEmployee(target.id).subscribe({ next: done, error: fail });
  }
}

function isDescendant(
  node: DepartmentNode,
  ancestorId: string,
  roots: readonly DepartmentNode[],
): boolean {
  const parentOf = new Map<string, string>();
  const walk = (nodes: readonly DepartmentNode[], parent: string | null): void => {
    for (const n of nodes) {
      if (parent) parentOf.set(n.department.id, parent);
      walk(n.children, n.department.id);
    }
  };
  walk(roots, null);
  let current: string | undefined = parentOf.get(node.department.id);
  while (current) {
    if (current === ancestorId) return true;
    current = parentOf.get(current);
  }
  return false;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function extractMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const status = (error as { status?: number }).status;
    if (status === 403) return '';
    const envelope = (error as { error?: { message?: string } }).error;
    if (envelope?.message) return envelope.message;
  }
  return '';
}

function actionErrorMessage(error: unknown, i18n: I18nService): string {
  if (isForbidden(error)) return i18n.t('common.forbidden.body');
  const message = extractMessage(error);
  return message || i18n.t('common.error.body');
}
