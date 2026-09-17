// E0.6 — single date/time + currency formatting helper (Back Office).
// Backend stores UTC ISO 8601; UI renders in Africa/Tunis.
// Arabic locale uses Western digits (latn) consistently across all clients.
export const APP_TIME_ZONE = 'Africa/Tunis';
export const CURRENCY_CODE = 'TND';

function coerceDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

export function formatDate(iso: string | null | undefined, locale: string): string {
  const d = coerceDate(iso);
  if (!d) return iso ?? '—';
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: APP_TIME_ZONE }).format(
      d,
    );
  } catch {
    return iso as string;
  }
}

export function formatDateTime(iso: string | null | undefined, locale: string): string {
  const d = coerceDate(iso);
  if (!d) return iso ?? '—';
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: APP_TIME_ZONE,
    }).format(d);
  } catch {
    return iso as string;
  }
}

/** Single currency helper — no manual amount string concatenation anywhere. */
export function formatTND(amount: number | string | null | undefined, locale: string): string {
  if (amount === null || amount === undefined || amount === '') return '—';
  const n = typeof amount === 'string' ? Number(amount) : amount;
  if (!Number.isFinite(n as number)) return String(amount);
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: CURRENCY_CODE,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      numberingSystem: 'latn',
    } as Intl.NumberFormatOptions).format(n as number);
  } catch {
    return `${Number(n).toFixed(2)} ${CURRENCY_CODE}`;
  }
}
