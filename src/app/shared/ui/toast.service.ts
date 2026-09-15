import { Injectable, signal } from '@angular/core';

export type ToastKind = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  readonly id: number;
  readonly kind: ToastKind;
  readonly message: string;
}

let nextId = 1;

/** Toast feedback for short-lived confirmations; critical ops also use inline alerts. */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly _toasts = signal<readonly Toast[]>([]);
  readonly toasts = this._toasts.asReadonly();

  show(kind: ToastKind, message: string, ttlMs = 4500): void {
    const toast: Toast = { id: nextId++, kind, message };
    this._toasts.update((t) => [...t, toast]);
    window.setTimeout(() => this.dismiss(toast.id), ttlMs);
  }

  dismiss(id: number): void {
    this._toasts.update((t) => t.filter((x) => x.id !== id));
  }
}
