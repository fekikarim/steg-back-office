/** Staff roles (authorization roles per domain model; NOT employee subclasses). */
export type StaffRole = 'HR' | 'SUPERVISOR' | 'FINANCE' | 'DIRECTOR' | 'ADMIN';

export const ALL_ROLES: readonly StaffRole[] = ['HR', 'SUPERVISOR', 'FINANCE', 'DIRECTOR', 'ADMIN'];

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
  | 'USER_MANAGE';

const ROLE_PERMISSIONS: Record<StaffRole, readonly Permission[]> = {
  HR: [
    'APPLICATION_VIEW',
    'APPLICATION_REVIEW',
    'CANDIDATE_VIEW',
    'INTERNSHIP_VIEW',
    'INTERNSHIP_ASSIGN',
    'DOCUMENT_VIEW',
    'REPORT_VIEW',
  ],
  SUPERVISOR: ['INTERNSHIP_VIEW', 'CANDIDATE_VIEW', 'DOCUMENT_VIEW', 'APPLICATION_VIEW'],
  FINANCE: [
    'FINANCE_CASE_VIEW',
    'FINANCE_PAYMENT_APPROVE',
    'DOCUMENT_VIEW',
    'DOCUMENT_VIEW_RESTRICTED',
    'REPORT_VIEW',
  ],
  DIRECTOR: [
    'APPLICATION_VIEW',
    'CANDIDATE_VIEW',
    'INTERNSHIP_VIEW',
    'DOCUMENT_VIEW',
    'FINANCE_CASE_VIEW',
    'REPORT_VIEW',
    'AUDIT_VIEW',
  ],
  ADMIN: [
    'APPLICATION_VIEW',
    'APPLICATION_REVIEW',
    'CANDIDATE_VIEW',
    'INTERNSHIP_VIEW',
    'INTERNSHIP_ASSIGN',
    'DOCUMENT_VIEW',
    'DOCUMENT_VIEW_RESTRICTED',
    'FINANCE_CASE_VIEW',
    'REPORT_VIEW',
    'AUDIT_VIEW',
    'USER_MANAGE',
  ],
};

export function permissionsFor(role: StaffRole): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}

export interface NavItem {
  readonly path: string;
  readonly labelKey: string;
  readonly icon: string;
  readonly permissions: readonly Permission[];
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
      { path: '/dashboard', labelKey: 'nav.dashboard', icon: 'dashboard', permissions: [] },
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
        path: '/assignments',
        labelKey: 'nav.assignments',
        icon: 'link',
        permissions: ['INTERNSHIP_ASSIGN'],
      },
      {
        path: '/documents',
        labelKey: 'nav.documents',
        icon: 'folder',
        permissions: ['DOCUMENT_VIEW'],
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
      { path: '/notifications', labelKey: 'nav.notifications', icon: 'bell', permissions: [] },
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
      (i) => i.permissions.length === 0 || i.permissions.some((p) => perms.has(p)),
    ),
  })).filter((s) => s.items.length > 0);
}
