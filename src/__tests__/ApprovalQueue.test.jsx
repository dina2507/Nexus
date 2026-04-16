import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { vi } from 'vitest';
import ApprovalQueue from '../components/ApprovalQueue';
import * as collections from '../firebase/collections';

vi.mock('../firebase/collections', () => ({
  subscribePendingActions: vi.fn(),
  resolveAction: vi.fn()
}));

vi.mock('framer-motion', () => ({
  motion: { div: ({ children, ...p }) => <div {...p}>{children}</div> },
  AnimatePresence: ({ children }) => <>{children}</>
}));

describe('ApprovalQueue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    collections.subscribePendingActions.mockImplementation((_id, _cb) => {
      return () => {};
    });
    collections.resolveAction.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders empty state when no pending actions', () => {
    collections.subscribePendingActions.mockImplementation((_id, _cb) => {
      _cb([]);
      return () => {};
    });
    render(<ApprovalQueue stadiumId="chepauk" />);
    expect(screen.getByText('All clear — no pending approvals')).toBeInTheDocument();
  });

  it('renders a PendingCard per pending action', () => {
    collections.subscribePendingActions.mockImplementation((_id, _cb) => {
      _cb([{ id: '1', action: 'Do something', priority: 4, stakeholder: 'security', risk_assessment: 'Test risk' }]);
      return () => {};
    });
    render(<ApprovalQueue stadiumId="chepauk" />);
    expect(screen.getByText('Do something')).toBeInTheDocument();
  });

  it('countdown reaches 0 -> calls onApprove with right closure', async () => {
    collections.subscribePendingActions.mockImplementation((_id, _cb) => {
      _cb([{ id: 'new-id', action: 'Action A', priority: 5, stakeholder: 'fans', risk_assessment: 'risk' }]);
      return () => {};
    });

    render(<ApprovalQueue stadiumId="chepauk" />);
    expect(screen.getByText('Action A')).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(61000);
    });

    expect(collections.resolveAction).toHaveBeenCalledWith('new-id', 'approved');
  });
});
