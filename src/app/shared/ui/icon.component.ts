import { Component, Input, booleanAttribute, inject } from '@angular/core';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';

/**
 * Single consistent institutional icon set (inline SVG, stroke-based).
 * No decorative emoji icons in institutional actions. Directional icons
 * auto-mirror in RTL via CSS `[dir="rtl"] .st-icon--mirror { transform: scaleX(-1) }`.
 */
const PATHS: Record<string, string> = {
  dashboard:
    '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  file: '<path d="M6 2h8l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z"/><path d="M14 2v6h6"/>',
  users:
    '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.6c2.4.4 4.3 2 5 5"/>',
  briefcase:
    '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  link: '<path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5"/>',
  folder: '<path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
  wallet:
    '<rect x="3" y="6" width="18" height="14" rx="2"/><path d="M3 10h18"/><circle cx="17" cy="15" r="1.2"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-8M21 20H3"/>',
  bell: '<path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  shield: '<path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5Z"/><path d="m9 12 2 2 4-4"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z"/>',
  globe:
    '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.7 3.8 9S14.5 18.4 12 21c-2.5-2.6-3.8-5.7-3.8-9S9.5 5.6 12 3Z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  chevronLeft: '<path d="M14.5 6 8.5 12l6 6"/>',
  chevronRight: '<path d="m9.5 6 6 6-6 6"/>',
  arrowLeft: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v6h-6"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 21h16"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  alert: '<path d="M12 3 2 20h20Z"/><path d="M12 10v4M12 17.5v.5"/>',
  check: '<path d="m4 12.5 5 5L20 6.5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5V8"/>',
  logout:
    '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
  collapse: '<path d="M4 6h16M4 12h10M4 18h16"/><path d="m17 10 3 2-3 2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
};

@Component({
  selector: 'st-icon',
  standalone: true,
  template: `<svg
    class="st-icon"
    [class.st-icon--mirror]="mirror"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
    [attr.width]="size"
    [attr.height]="size"
    [innerHTML]="svg()"
  ></svg>`,
  styles: [
    `
      .st-icon {
        display: inline-block;
        flex: none;
        vertical-align: -0.15em;
      }
      :host-context([dir='rtl']) .st-icon--mirror {
        transform: scaleX(-1);
      }
    `,
  ],
})
export class StIconComponent {
  @Input() name = 'info';
  @Input() size = 18;
  @Input({ transform: booleanAttribute }) mirror = false;
  private readonly sanitizer = inject(DomSanitizer);

  svg(): SafeHtml {
    // Static first-party icon paths only — safe to bypass Angular sanitization.
    return this.sanitizer.bypassSecurityTrustHtml(PATHS[this.name] ?? PATHS['info'] ?? '');
  }
}
