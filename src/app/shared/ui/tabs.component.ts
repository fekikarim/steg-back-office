import { Component, Input, Output, EventEmitter } from '@angular/core';

export interface TabItem {
  readonly id: string;
  readonly label: string;
  readonly count?: number;
}

/** Accessible tabs (roving via buttons + arrow-key support). */
@Component({
  selector: 'st-tabs',
  standalone: true,
  template: `
    <div class="st-tabs" role="tablist" [attr.aria-label]="label" (keydown)="onKey($event)">
      @for (tab of tabs; track tab.id) {
        <button
          type="button"
          role="tab"
          class="st-tab"
          [class.st-tab--active]="tab.id === activeId"
          [attr.aria-selected]="tab.id === activeId"
          [tabindex]="tab.id === activeId ? 0 : -1"
          (click)="select.emit(tab.id)"
        >
          {{ tab.label }}
          @if (tab.count !== undefined) {
            <span class="st-tab__count">{{ tab.count }}</span>
          }
        </button>
      }
    </div>
  `,
  styles: [
    `
      .st-tabs {
        display: flex;
        gap: 0.25rem;
        border-block-end: 1px solid var(--border-subtle);
        overflow-x: auto;
      }
      .st-tab {
        border: 0;
        background: none;
        padding: 0.6rem 0.8rem;
        font-size: 0.85rem;
        font-weight: 600;
        color: var(--text-secondary);
        cursor: pointer;
        border-block-end: 2px solid transparent;
        margin-block-end: -1px;
        display: inline-flex;
        gap: 0.4rem;
        align-items: center;
        white-space: nowrap;
      }
      .st-tab--active {
        color: var(--action-primary);
        border-block-end-color: var(--action-primary);
      }
      .st-tab:focus-visible {
        outline: 2px solid var(--action-primary);
        outline-offset: 2px;
        border-radius: 0.3rem;
      }
      .st-tab__count {
        font-size: 0.72rem;
        background: var(--border-subtle);
        border-radius: 999px;
        padding: 0.1rem 0.45rem;
      }
    `,
  ],
})
export class TabsComponent {
  @Input() tabs: readonly TabItem[] = [];
  @Input() activeId = '';
  @Input() label = 'Sections';
  @Output() select = new EventEmitter<string>();

  onKey(event: KeyboardEvent): void {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    const ids = this.tabs.map((t) => t.id);
    const idx = ids.indexOf(this.activeId);
    const rtl = document.documentElement.dir === 'rtl';
    const delta = event.key === 'ArrowRight' ? (rtl ? -1 : 1) : rtl ? 1 : -1;
    const next = ids[(idx + delta + ids.length) % ids.length];
    if (next) {
      this.select.emit(next);
      event.preventDefault();
    }
  }
}
