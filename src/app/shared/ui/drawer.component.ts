import { Component, Input, Output, EventEmitter, ElementRef, inject } from '@angular/core';

/** Side drawer: detail views on desktop, full sheet on mobile. Correct side in RTL via logical inset. */
@Component({
  selector: 'st-drawer',
  standalone: true,
  template: `
    @if (open) {
      <div class="st-drawer-backdrop" (click)="onBackdrop($event)">
        <aside
          class="st-drawer"
          role="dialog"
          aria-modal="true"
          tabindex="-1"
          [attr.aria-label]="title"
          (keydown.escape)="close.emit()"
        >
          <div class="st-drawer__head">
            <h2 class="st-drawer__title">{{ title }}</h2>
            <button
              type="button"
              class="st-icon-btn"
              (click)="close.emit()"
              aria-label="Close panel"
            >
              ✕
            </button>
          </div>
          <div class="st-drawer__body"><ng-content /></div>
        </aside>
      </div>
    }
  `,
  styles: [
    `
      .st-drawer-backdrop {
        position: fixed;
        inset: 0;
        background: rgb(2 12 24 / 0.45);
        z-index: 140;
      }
      .st-drawer {
        position: fixed;
        inset-block: 0;
        inset-inline-end: 0;
        inline-size: min(26rem, 100%);
        background: var(--bg-elevated);
        border-inline-start: 1px solid var(--border-default);
        display: flex;
        flex-direction: column;
        box-shadow: var(--shadow-md);
      }
      .st-drawer__head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.9rem 1rem;
        border-block-end: 1px solid var(--border-subtle);
      }
      .st-drawer__title {
        margin: 0;
        font-size: 1rem;
      }
      .st-drawer__body {
        padding: 1rem;
        overflow: auto;
        display: grid;
        gap: 0.75rem;
        align-content: start;
      }
      @media (max-width: 767px) {
        .st-drawer {
          inline-size: 100%;
        }
      }
    `,
  ],
})
export class DrawerComponent {
  @Input() open = false;
  @Input() title = '';
  @Output() close = new EventEmitter<void>();
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);

  ngOnChanges(): void {
    if (this.open) {
      queueMicrotask(() => {
        this.host.nativeElement
          .querySelector<HTMLElement>('.st-drawer')
          ?.focus({ preventScroll: true });
      });
    }
  }

  onBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.close.emit();
  }
}
