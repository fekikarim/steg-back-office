/**
 * STEG semantic design tokens (single source of truth for Back Office).
 * Institutional, restrained presentation of the shared STEG palette.
 * UI_UX.md: brand-primary #0B61A0, brand-red #D32325, brand-red-dark #B02927,
 * brand-navy #042843 + neutral scale. Light/dark surfaces via CSS variables.
 */
export const STEG_TOKENS = {
  brandPrimary: '#0B61A0',
  brandRed: '#D32325',
  brandRedDark: '#B02927',
  brandNavy: '#042843',
} as const;

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';
