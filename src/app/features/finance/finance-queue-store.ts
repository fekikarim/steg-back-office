import { Injectable } from '@angular/core';
import type { FinanceCaseStatus } from '../../core/api-models';

/** Preserved finance-queue UI state so back-navigation restores filters/page. */
export interface FinanceQueueState {
  status: FinanceCaseStatus | '';
  page: number;
  size: number;
  sortDir: 'asc' | 'desc';
  openedFrom: string;
  openedTo: string;
  department: string;
  eligibility: '' | 'eligible' | 'not-eligible';
}

export const DEFAULT_FINANCE_QUEUE_STATE: FinanceQueueState = {
  status: '',
  page: 0,
  size: 20,
  sortDir: 'desc',
  openedFrom: '',
  openedTo: '',
  department: '',
  eligibility: '',
};

/** Session-scoped store (not persisted): survives route changes, resets on reload. */
@Injectable({ providedIn: 'root' })
export class FinanceQueueStore {
  private state: FinanceQueueState = { ...DEFAULT_FINANCE_QUEUE_STATE };

  get(): FinanceQueueState {
    return { ...this.state };
  }

  set(patch: Partial<FinanceQueueState>): void {
    this.state = { ...this.state, ...patch };
  }
}
