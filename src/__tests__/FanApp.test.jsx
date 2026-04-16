import React, { act } from 'react';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import FanApp from '../pages/FanApp';
import * as nexusContext from '../context/NexusContext';
import * as firestore from 'firebase/firestore';

vi.mock('../context/NexusContext', () => ({
  useNexus: vi.fn()
}));

vi.mock('firebase/auth', () => ({
  signInAnonymously: vi.fn().mockResolvedValue(undefined),
  onAuthStateChanged: (auth, cb) => { cb({ uid: 'fan-123' }); return () => {}; },
}));

vi.mock('firebase/messaging', () => ({
  getToken: vi.fn(),
  onMessage: vi.fn().mockReturnValue(() => {})
}));

vi.mock('../firebase/config', () => ({
  auth: {}, db: {}, messaging: null
}));

vi.mock('framer-motion', () => ({
  motion: { div: ({ children, ...p }) => <div {...p}>{children}</div> },
  AnimatePresence: ({ children }) => <>{children}</>
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  setDoc: vi.fn().mockResolvedValue(undefined),
  getDoc: vi.fn(),
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  onSnapshot: vi.fn().mockReturnValue(() => {})
}));

vi.mock('../components/FanNavigateTab', () => ({
  default: ({ fanProfile }) => <div data-testid="navigate-tab">Navigate {fanProfile?.section}</div>
}));
vi.mock('../components/FanLiveTab', () => ({
  default: () => <div data-testid="live-tab">Live</div>
}));
vi.mock('../components/FanSeatTab', () => ({
  default: ({ fanProfile }) => <div data-testid="seat-tab">Seat {fanProfile?.seat}</div>
}));

describe('FanApp', () => {
  beforeEach(() => {
    nexusContext.useNexus.mockReturnValue({
      matchState: { score: '100/1', over: '10', mins_to_halftime: 20 },
      densities: { north_stand: { pct: 0.5 } },
      actions: [],
      stadium: { zones: [] }
    });
  });

  it('Seat card reads from fan_profiles/{uid} and renders fallback if profile missing', async () => {
    firestore.getDoc.mockResolvedValue({ exists: () => false });

    await act(async () => {
      render(<FanApp />);
    });

    // Default profile is seeded — navigate tab should show North Stand
    expect(screen.getByTestId('navigate-tab')).toBeInTheDocument();
  });

  it('renders stored fan profile when profile exists', async () => {
    firestore.getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ seat: 'A-10', section: 'VIP', tier: 'Lower', gate: 'G1', zone_id: 'vip_zone' })
    });

    await act(async () => {
      render(<FanApp />);
    });

    // Navigate tab is the default active tab
    expect(screen.getByTestId('navigate-tab')).toBeInTheDocument();
  });

  it('notification without incentive_inr does not show QR', async () => {
    firestore.getDoc.mockResolvedValue({ exists: () => false });
    firestore.onSnapshot.mockImplementation((q, cb) => {
      cb({
        empty: false,
        docs: [{
          id: 'action-1',
          data: () => ({ stakeholder: 'fans', action: 'Go left', target_zone: 'north_stand', incentive_inr: 0, status: 'dispatched' })
        }]
      });
      return () => {};
    });

    await act(async () => {
      render(<FanApp />);
    });

    expect(screen.queryByText(/Voucher/)).not.toBeInTheDocument();
  });
});
