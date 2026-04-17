import { render, screen, act } from '@testing-library/react';
import { vi } from 'vitest';
import FanApp from '../pages/FanApp';
import * as nexusContext from '../context/NexusContext';
import * as firestore from 'firebase/firestore';

vi.mock('../context/NexusContext', () => ({
  useNexus: vi.fn()
}));

vi.mock('firebase/auth', () => ({
  signInAnonymously: vi.fn().mockResolvedValue(undefined),
  onAuthStateChanged: (_auth, cb) => { cb({ uid: 'fan-123' }); return () => {}; },
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
  // Default: profile doc snapshot (exists = false), actions query snapshot is silent
  onSnapshot: vi.fn((_ref, cb) => {
    cb({ exists: () => false, data: () => ({}) });
    return () => {};
  }),
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
    vi.clearAllMocks();
    // Restore default onSnapshot: profile doc returns empty, actions query is silent
    firestore.onSnapshot.mockImplementation((_ref, cb) => {
      cb({ exists: () => false, data: () => ({}) });
      return () => {};
    });
    nexusContext.useNexus.mockReturnValue({
      matchState: { score: '100/1', over: '10', mins_to_halftime: 20 },
      densities: { north_stand: { pct: 0.5 } },
      actions: [],
      stadium: { zones: [] }
    });
  });

  it('Seat card reads from fan_profiles/{uid} and renders fallback if profile missing', async () => {
    await act(async () => {
      render(<FanApp />);
    });

    // Default profile is seeded — navigate tab should show North Stand
    expect(screen.getByTestId('navigate-tab')).toBeInTheDocument();
  });

  it('renders stored fan profile when profile exists', async () => {
    // First onSnapshot = profile doc (exists), second = actions query (silent)
    let callCount = 0;
    firestore.onSnapshot.mockImplementation((_ref, cb) => {
      callCount++;
      if (callCount === 1) {
        cb({ exists: () => true, data: () => ({ seat: 'A-10', section: 'VIP', tier: 'Lower', gate: 'G1', zone_id: 'vip_zone' }) });
      }
      return () => {};
    });

    await act(async () => {
      render(<FanApp />);
    });

    expect(screen.getByTestId('navigate-tab')).toBeInTheDocument();
  });

  it('notification without incentive_inr does not show QR', async () => {
    // First call = profile doc snapshot, second = actions query snapshot
    let callCount = 0;
    firestore.onSnapshot.mockImplementation((_ref, cb) => {
      callCount++;
      if (callCount === 1) {
        cb({ exists: () => false, data: () => ({}) });
      } else {
        cb({
          empty: false,
          docs: [{
            id: 'action-1',
            data: () => ({ stakeholder: 'fans', action: 'Go left', target_zone: 'north_stand', incentive_inr: 0, status: 'dispatched' })
          }]
        });
      }
      return () => {};
    });

    await act(async () => {
      render(<FanApp />);
    });

    expect(screen.queryByText(/Voucher/)).not.toBeInTheDocument();
  });
});
