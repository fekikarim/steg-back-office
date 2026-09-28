import { describe, it, expect } from 'vitest';
import { deriveValidationState } from './api-models';
import type { WorkflowActionResponse } from './api-models';

function action(
  overrides: Partial<WorkflowActionResponse> & { sequenceNumber: number },
): WorkflowActionResponse {
  return {
    id: `a${overrides.sequenceNumber}`,
    instanceId: 'wf-1',
    stepCode: 'COMPLETED',
    stepName: 'Completed',
    performedById: 'u-hr',
    performedByUsername: 'hr.steg',
    type: 'VALIDATION',
    decision: 'APPROVED',
    comment: null,
    performedAt: '2026-08-01T09:00:00Z',
    ...overrides,
  };
}

describe('deriveValidationState', () => {
  it('returns empty state when no actions exist', () => {
    expect(deriveValidationState([])).toEqual({
      decision: null,
      comment: null,
      performedBy: null,
      performedAt: null,
    });
  });

  it('ignores non-validation and non-completed actions', () => {
    const actions = [
      action({ sequenceNumber: 1, type: 'COMPLETION', decision: 'APPROVED' }),
      action({ sequenceNumber: 2, stepCode: 'ACTIVE', decision: 'APPROVED' }),
    ];
    expect(deriveValidationState(actions).decision).toBeNull();
  });

  it('picks the latest validation decision by sequence number', () => {
    const actions = [
      action({ sequenceNumber: 3, decision: 'REJECTED', comment: 'Missing report' }),
      action({ sequenceNumber: 4, decision: 'APPROVED', comment: 'Fixed' }),
    ];
    const state = deriveValidationState(actions);
    expect(state.decision).toBe('APPROVED');
    expect(state.comment).toBe('Fixed');
    expect(state.performedBy).toBe('hr.steg');
  });

  it('a later rejection overrides an earlier approval', () => {
    const actions = [
      action({ sequenceNumber: 3, decision: 'APPROVED' }),
      action({ sequenceNumber: 4, decision: 'NEEDS_CORRECTION', comment: 'Dates wrong' }),
    ];
    expect(deriveValidationState(actions).decision).toBe('NEEDS_CORRECTION');
  });

  it('PENDING decisions do not count as validation', () => {
    expect(
      deriveValidationState([action({ sequenceNumber: 3, decision: 'PENDING' })]).decision,
    ).toBeNull();
  });
});
