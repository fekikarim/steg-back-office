import { TestBed } from '@angular/core/testing';
import { I18nService } from './i18n.service';
import { ThemeService } from './theme.service';

describe('I18nService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({});
    localStorage.clear();
  });

  it('defaults to French LTR', () => {
    const i18n = TestBed.inject(I18nService);
    expect(i18n.locale()).toBe('fr');
    expect(i18n.isRtl()).toBe(false);
    expect(i18n.t('nav.dashboard')).toBeTruthy();
  });

  it('arabic switches to true RTL with translated strings', () => {
    const i18n = TestBed.inject(I18nService);
    i18n.setLocale('ar');
    expect(i18n.locale()).toBe('ar');
    expect(i18n.isRtl()).toBe(true);
    expect(document.documentElement.dir).toBe('rtl');
    expect(i18n.t('nav.dashboard')).not.toBe('Dashboard');
    i18n.setLocale('fr');
    expect(document.documentElement.dir).toBe('ltr');
  });

  it('interpolates params and falls back to key', () => {
    const i18n = TestBed.inject(I18nService);
    i18n.setLocale('en');
    expect(i18n.t('table.pageOf', { page: 1, pages: 5 })).toContain('1');
    expect(i18n.t('missing.key.xyz')).toBe('missing.key.xyz');
  });
});

describe('ThemeService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({});
    localStorage.clear();
  });

  it('persists mode and applies data-theme without reload', () => {
    const theme = TestBed.inject(ThemeService);
    theme.setMode('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem('steg-bo-theme')).toBe('dark');
    theme.setMode('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
});
