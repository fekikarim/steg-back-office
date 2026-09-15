import type { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { I18nService } from './i18n.service';

/**
 * Professional i18n sync: every API request carries the current UI locale
 * as Accept-Language, so the backend can return localized messages,
 * validation errors and notification templates in fr/en/ar. The header
 * value is the STEG primary locale code (fr, en, ar).
 */
export const i18nInterceptor: HttpInterceptorFn = (req, next) => {
  const i18n = inject(I18nService);
  const locale = i18n.locale();
  // Always send the current locale; backend will fallback to fr if unsupported
  return next(req.clone({ setHeaders: { 'Accept-Language': locale } }));
};
