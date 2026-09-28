/**
 * Back-office roles: ADMIN and SUPERVISOR only.
 *
 * HR, FINANCE and DIRECTOR were removed permanently (backend V34): they have
 * no Back Office access and must not appear in navigation, pages, permissions
 * or UI. Backend roles still required by other clients (CANDIDATE, INTERN)
 * are likewise denied here — see AuthService for the login gate.
 */
export type StaffRole = 'ADMIN' | 'SUPERVISOR';

export const ALL_ROLES: readonly StaffRole[] = ['ADMIN', 'SUPERVISOR'];

/** Returns true for the two roles permitted inside the Back Office. */
export function isBackOfficeRole(role: string | null | undefined): role is StaffRole {
  return role === 'ADMIN' || role === 'SUPERVISOR';
}

/** Granular permissions (subset used for navigation gating; backend is authoritative). */
export type Permission =
  | 'APPLICATION_VIEW'
  | 'APPLICATION_REVIEW'
  | 'CANDIDATE_VIEW'
  | 'INTERNSHIP_VIEW'
  | 'INTERNSHIP_ASSIGN'
  | 'DOCUMENT_VIEW'
  | 'DOCUMENT_VIEW_RESTRICTED'
  | 'FINANCE_CASE_VIEW'
  | 'FINANCE_PAYMENT_APPROVE'
  | 'REPORT_VIEW'
  | 'AUDIT_VIEW'
  | 'USER_MANAGE'
  | 'NOTIFICATION_MANAGE';

/**
 * Final permission matrix.
 *
 * ADMIN: candidates, applications, internships, certificates, validation,
 * receipts, tasks, audit, notifications, reports, AI features — everything.
 *
 * SUPERVISOR: validation management (supervision workspace, reviews,
 * evaluations, validation tracking) + receipt management on assigned cases
 * (scoped backend-side). No candidates, applications, general internship
 * management, certificates, tasks page, audit, notifications or reports.
 */
const ROLE_PERMISSIONS: Record<StaffRole, readonly Permission[]> = {
  ADMIN: [
    'APPLICATION_VIEW',
    'APPLICATION_REVIEW',
    'CANDIDATE_VIEW',
    'INTERNSHIP_VIEW',
    'INTERNSHIP_ASSIGN',
    'DOCUMENT_VIEW',
    'DOCUMENT_VIEW_RESTRICTED',
    'FINANCE_CASE_VIEW',
    'FINANCE_PAYMENT_APPROVE',
    'REPORT_VIEW',
    'AUDIT_VIEW',
    'USER_MANAGE',
    'NOTIFICATION_MANAGE',
  ],
  SUPERVISOR: ['INTERNSHIP_VIEW', 'DOCUMENT_VIEW', 'FINANCE_CASE_VIEW', 'FINANCE_PAYMENT_APPROVE'],
};

export function permissionsFor(role: StaffRole): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}

export interface NavItem {
  readonly path: string;
  readonly labelKey: string;
  readonly icon: string;
  readonly permissions: readonly Permission[];
  /** Optional allowlist: item renders only for these roles (default: all permission holders). */
  readonly roles?: readonly StaffRole[];
  /** UX convenience only — backend remains the authorization authority. */
  readonly hint?: string;
}

export interface NavSection {
  readonly titleKey: string;
  readonly items: readonly NavItem[];
}

/** Role/permission-aware navigation. Visibility is UX convenience, never authorization. */
export const NAV_SECTIONS: readonly NavSection[] = [
  {
    titleKey: 'nav.section.pilotage',
    items: [
      {
        path: '/dashboard',
        labelKey: 'nav.dashboard',
        icon: 'dashboard',
        permissions: [],
        roles: ['ADMIN'],
      },
      {
        path: '/supervisor-dashboard',
        labelKey: 'nav.dashboard',
        icon: 'dashboard',
        permissions: ['INTERNSHIP_VIEW'],
        roles: ['SUPERVISOR'],
      },
      { path: '/reports', labelKey: 'nav.reports', icon: 'chart', permissions: ['REPORT_VIEW'] },
    ],
  },
  {
    titleKey: 'nav.section.operations',
    items: [
      {
        path: '/applications',
        labelKey: 'nav.applications',
        icon: 'file',
        permissions: ['APPLICATION_VIEW'],
      },
      {
        path: '/candidates',
        labelKey: 'nav.candidates',
        icon: 'users',
        permissions: ['CANDIDATE_VIEW'],
      },
      {
        path: '/internships',
        labelKey: 'nav.internships',
        icon: 'briefcase',
        permissions: ['INTERNSHIP_VIEW'],
      },
      {
        path: '/supervisor',
        labelKey: 'nav.supervisor',
        icon: 'eye',
        permissions: ['INTERNSHIP_VIEW'],
      },
      {
        path: '/finance',
        labelKey: 'nav.finance',
        icon: 'wallet',
        permissions: ['FINANCE_CASE_VIEW'],
      },
    ],
  },
  {
    titleKey: 'nav.section.controle',
    items: [
      {
        path: '/notifications',
        labelKey: 'nav.notifications',
        icon: 'bell',
        permissions: ['NOTIFICATION_MANAGE'],
      },
      {
        path: '/tasks',
        labelKey: 'nav.tasks',
        icon: 'check',
        permissions: ['APPLICATION_REVIEW'],
      },
      { path: '/audit', labelKey: 'nav.audit', icon: 'shield', permissions: ['AUDIT_VIEW'] },
      { path: '/admin', labelKey: 'nav.admin', icon: 'gear', permissions: ['USER_MANAGE'] },
    ],
  },
];

export function visibleNav(role: StaffRole | null): NavSection[] {
  if (!role) {
    const first = NAV_SECTIONS[0];
    const home = first?.items[0];
    return home ? [{ titleKey: 'nav.section.pilotage', items: [home] }] : [];
  }
  const perms = new Set<Permission>(permissionsFor(role));
  return NAV_SECTIONS.map((s) => ({
    ...s,
    items: s.items.filter(
      (i) =>
        (i.permissions.length === 0 || i.permissions.some((p) => perms.has(p))) &&
        (!i.roles || i.roles.includes(role)),
    ),
  })).filter((s) => s.items.length > 0);
}
