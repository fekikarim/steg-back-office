# Back Office — QA Report (Phase C7 + hotfix 2026-09-15)

Date: 2026-09-15 · App: `steg-back-office` (Angular 22.1.6, standalone, strict TS)
Scope: full quality gate — visual, responsive, RTL, accessibility, performance,
security UX, E2E. Backend live at `http://localhost:8080` (auth-gated, 401
verified); E2E runs hermetically against a stateful mocked API.
Addendum §11 documents the post-login infinite-loop hotfix.

## 1. Gate results (evidence)

| Gate                 | Command                                      | Result                            |
| -------------------- | -------------------------------------------- | --------------------------------- |
| Lint + typecheck     | `npm run lint` (prettier + `tsc` app & spec) | ✅ pass                           |
| Unit/component       | `npm test` (vitest)                          | ✅ 25 files / 124 tests pass      |
| Production build     | `npm run build`                              | ✅ pass, 0 warnings               |
| E2E chromium         | `npx playwright test --project=chromium`     | ✅ 16/16 pass                     |
| E2E mobile (Pixel 7) | `npx playwright test --project=mobile`       | ✅ 3/3 pass                       |
| i18n parity          | key audit script                             | ✅ 458 keys × fr/en/ar, 0 missing |

Build output (post-hotfix): initial `main` 89 kB raw / 22 kB transfer
(total initial 372 kB raw / 99 kB transfer); 16+ lazy chunks per route
(e.g. `internship-detail` 8.7 kB, `finance-detail` 6.9 kB transfer).
All feature routes use `loadComponent` (verified in `app.routes.ts` and in
the build's "Lazy chunk files" list).

## 2. Visual audit — formal institutional appearance ✅

- Palette restricted to STEG tokens (`--brand-primary #0b61a0`, navy,
  neutrals; red reserved for danger/restricted states). No gradients,
  no decorative animation (only skeleton shimmer, disabled under
  `prefers-reduced-motion`), no SaaS gimmicks.
- Tables, buttons (`.st-btn` variants), badges and `st-icon` set are shared
  components reused on every screen — verified by import audit.
- Iconography: single inline-SVG set; added `sparkles` (AI), `upload`,
  `print` glyphs in the same stroke style. Only text glyph is `✕` on
  labelled close buttons (accessible name present).
- Hierarchy: `st-page-header` (title + actions) + breadcrumbs + tabs on
  every workspace; section cards with labelled headings.

## 3. Responsive audit ✅ (mobile 412px, tablet 768px, desktop 1280px+)

- Sidebar → drawer under 1023 px with scrim + `aria-hidden` management;
  topbar compresses (search/meta hidden ≤767 px) and now wraps instead of
  overflowing (fixed in C7).
- Tables: priority columns hide progressively; drawers become full sheets;
  dialogs fit small viewports (E2E-asserted bounding boxes).
- **Found & fixed:** 200 % zoom on mobile produced 350 px horizontal
  overflow (nowrap `.st-btn` + non-wrapping `.st-top`). Fixed with
  button-label wrapping ≤480 px and topbar `flex-wrap`; E2E asserts
  zero page-level overflow at 200 % zoom.

## 4. RTL audit (fr/en/ar, full pages) ✅

- No physical CSS (`margin-left`, `left:`, …) anywhere in app code;
  logical properties throughout; `document.dir` switches `ltr/rtl` with
  `lang`; Arabic line-height 1.7; `dir="auto"` on names, `dir="ltr"` on
  references/emails/UUIDs/tokens.
- Directional icons mirror via `[dir='rtl'] .st-icon--mirror`
  (pagination chevrons verified); sidebar docks physical-right in RTL
  (E2E asserts bounding box against the viewport edge).
- **Found & fixed:** 94 Arabic keys missing (C2/C3-era screens fell back
  to French). All 458 keys now translated; parity script gates regressions.

## 5. Accessibility (WCAG 2.2 AA-oriented) ✅

- Keyboard: skip link `#st-content`, native controls, roving tabs,
  Escape-closes dialogs/drawers, Enter submits, E2E keyboard-only flow
  (login → review → dialog → Escape) passes.
- **Found & fixed:** dialogs/drawers never received focus on open.
  `st-dialog`/`st-drawer` now move focus to the panel (`tabindex="-1"`,
  `preventScroll`); keyboard E2E asserts `toBeFocused()`.
- Semantics: `th scope="col"`, tablist/tab/tabpanel roles, `aria-modal`,
  labelled dialogs, `aria-live` toasts/pagination, `role="alert"` errors,
  decorative bars `aria-hidden` with text equivalents (no color-only status
  — every badge pairs color with text).
- Contrast (measured): primary/secondary/inverse ≥ 6.5:1 both themes.
  **Found & fixed:** `--text-muted` was 4.23:1 → darkened to `#576b80`
  (5.5:1 on white). Dark-theme muted `#8fa1b3` measures 5.8:1.
- Zoom 200 % verified (see §3); touch targets use 2.5–2.75 rem min sizes.

## 6. Performance ✅

- Server-side pagination + sorting everywhere the backend supports it
  (finance queue, audit, notifications); page size capped (default 20,
  max 100).
- Bounded joins only: finance queue enriches ≤ page-size rows
  (≤40 small requests, failures isolated per row); internship list joins
  assignment histories the same way. Documented in code; no unbounded
  fan-out.
- Lazy routes (see §1); charts are CSS-only distribution bars
  (no chart library, no JS cost, theme-adaptive).
- No `console.log`/debug code in app sources (audit-clean).

## 7. Security UX ✅

- Every shell route carries `authGuard` + `permissionGuard([...])`
  (notifications route gained its guard in C7); nav hides unauthorized
  sections; action buttons are permission/role-gated
  (e.g. finance approve requires `role === 'FINANCE'`, matching the
  backend's `hasRole('FINANCE')`; ADMIN correctly sees no decision buttons).
- 401 → login, 403 → forbidden page + user-safe toast via the central
  interceptor; no secrets or stack traces in messages; tokens in-memory
  only (demo IAM — see §9).
- Restricted (CIN) documents: sensitive badge, disabled actions without
  `DOCUMENT_VIEW_RESTRICTED`, guarded download endpoints, audited-attempt
  messaging. E2E covers HR-denied, ADMIN-allowed, DIRECTOR-denied paths.
- No client-side trust: guards/states are UX convenience; every mutation
  is a backend call with server confirmation (verified per-phase).

## 8. E2E evidence (`e2e/`, Playwright 1.63, Chromium + Pixel 7)

Hermetic stateful mock (`e2e/mock-backend.ts`, shapes per `api-models.ts`):

- `auth.spec.ts` — redirect when unauthenticated, demo login,SUPERVISOR→`/finance` and HR→`/admin` denials.
- `lifecycle.spec.ts` — login → HR review → accept → create internship →
  activate → assign supervisor → complete → certificate → FINANCE approve
  (receipt-consequence confirm) → receipt `PAY-2026-000004` download;
  plus reject-requires-reason flow.
- `roles.spec.ts` — nav hiding + route denials + ADMIN read-only finance.
- `restricted-docs.spec.ts` — badge/disabled states, guarded-endpoint
  download, filename correctness (`cv.pdf`, not a blob-UUID name).
- `rtl.spec.ts`, `responsive.spec.ts`, `keyboard.spec.ts` — see §3–§5.
- Result: **19/19 pass**. Live-backend variant: backend is up and
  auth-gated (401 on `/api/finance-cases`, `/api/audit`); full live runs
  await seeded staff accounts (see §9).

## 9. Fixes applied in this phase

1. Lazy `loadComponent` routes (+ notifications guard).
2. `--text-muted` contrast 4.23 → 5.5:1.
3. 94 missing Arabic translations (parity now 458×3).
4. Dialog/drawer initial focus management.
5. Dossier "Download" actually downloaded (was `window.open` preview with
   a blob-UUID filename) + unit test lock-in.
6. Topbar wrap + button-label wrap (200 % zoom overflow).
7. Removed dead `BadgeComponent` imports (audit-viewer, internship-create)
   and an obsolete `?? ''` (build warnings → zero).

## 10. Hotfix — post-login infinite reload loop (reported 2026-09-15)

**Symptom:** after demo login the app navigated to `/dashboard` then
continuously reloaded all routes. Manual refresh made the loop visible;
automated E2E had not caught it because the mock backend always returned 200.

**Root causes (all required for the loop):**

1. **Guards used side-effect `router.navigate()` + `return false`.**  
   Angular treats that as two navigations in one tick; with concurrent
   401/403 toasts from the dashboard's 8 parallel report requests the
   router queued repeated navigations to `/login` → `/forbidden` →
   `/dashboard`.

2. **Global error interceptor handled every 401/403 as a navigation.**
   - `401` → `router.navigate(['/login'], {returnTo})`
   - `403` → toast + `router.navigate(['/forbidden'])`  
     Role-scoped dashboard reports legitimately 401/403 for HR vs Finance.
     Those are expected as per-dataset "unavailable", not as a global logout.
     With demo IAM (no JWT, no `Authorization` header) every report
     returned 401, firing 8 concurrent navigations.

3. **`LoginComponent.ngOnInit` auto-redirected unconditionally.**  
   `if (isAuthenticated) navigate('/dashboard')` bounced every
   interceptor-driven `/login?returnTo=…` straight back to `/dashboard`,
   re-triggering the 8 requests → 8 more 401s → loop.

4. **`ThemeService` ran an infinite `requestAnimationFrame` poll** to keep
   `data-theme` in sync. It invoked `apply()` every frame, forcing style
   recalc and keeping the app in a hot change-detection cycle.

**Fixes (all verified, no `any`/`@ts-ignore`):**

- **Guards → `UrlTree`:** `authGuard`/`permissionGuard` now return
  `router.createUrlTree(['/login'], {queryParams})` or `'/forbidden'`
  instead of navigating. Single navigation, no queue. `returnTo` is
  validated (`isSafeReturnTo`) to block open-redirect via `//` or `http:`.
- **Error interceptor → throttled + suppressible:**  
  `SKIP_GLOBAL_ERROR` context token; `ApiClient` marks all dashboard
  reporting endpoints (and other read-only GETs) as silent so the
  dashboard can render per-dataset `unavailable`/`error` states. Remaining
  401s in demo mode (no `Authorization` header) are treated as data errors
  (re-thrown, not navigated). 403s toast but only navigate if not already
  on `/login`/`/forbidden` and throttled to 800 ms.
- **`ThemeService` → `effect()`:** replaced the `requestAnimationFrame`
  loop with `effect(() => apply(resolved()))`; `mediaQuery` listener stays.
  No constant rAF, no forced style recalc.
- **Login → safe `returnTo`:** `ngOnInit` now reads `?returnTo` via
  `ActivatedRoute`, validates it, and navigates there; `signInDemo`
  honors the same param. No unconditional bounce.
- **Dashboard data layer → 401 as unavailable:** `isForbidden()` now treats
  401 like 403 for dataset mapping, so demo 401s render as
  "Non disponible pour votre rôle" instead of forcing a logout.
- **E2E isolation:** `e2e/auth.spec.ts` clears `localStorage` before the
  unauthenticated test and asserts `/login(\?.*)?` to allow the safe
  `returnTo` param.

**Post-fix verification:**

- `npm run lint` ✅, `npm test` ✅ 25/124, `npm run build` ✅ (372 kB,
  0 warnings), `npx playwright test` ✅ 19/19 (16 chromium + 3 mobile).
- Manual: login as HR → dashboard renders KPIs + per-section
  "unavailable" notes, no navigation loop; refresh stays on dashboard;
  backend down shows retryable error states, not a loop. Language switch,
  drawer, and dialogs remain smooth at 200 % zoom.

## 11. Known limitations (not defects)

- **Demo IAM**: login is shape-validating demo sign-in; real JWT wiring is
  pending backend IAM exposure. Tokens are in-memory only; backend stays
  the authorization authority (E2E mocks the API contract, not auth).
- **Placeholders remain** for assignments hub, documents hub, reports and
  notifications (routes/guards/nav real; out-of-scope phases).
- **Seeded E2E**: hermetic mocks; run against a seeded backend before
  production sign-off (`POST /api/auth/login` staff accounts required).
- Manual screen-reader pass (NVDA/VoiceOver) and device lab recommended
  before release; automated checks above are necessary but not sufficient.
