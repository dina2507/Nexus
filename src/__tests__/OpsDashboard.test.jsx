import { render, screen, fireEvent, act } from '@testing-library/react';
import { vi } from 'vitest';
import OpsDashboard from '../pages/OpsDashboard';
import * as nexusContext from '../context/NexusContext';
import * as firestore from 'firebase/firestore';

vi.mock('../context/NexusContext', () => ({
  useNexus: vi.fn()
}));

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (auth, cb) => { cb({ email: 'test@example.com' }); return () => {}; },
  signOut: vi.fn(),
  getAuth: vi.fn()
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  onSnapshot: vi.fn(),
  setDoc: vi.fn()
}));

vi.mock('../firebase/config', () => ({
  auth: {}, db: {}
}));

vi.mock('../components/StadiumMap', () => ({ default: () => <div data-testid="stadium-map" /> }));
vi.mock('../components/ImpactChart', () => ({ default: () => <div data-testid="impact-chart" /> }));
vi.mock('../components/StadiumPicker', () => ({ default: () => <span>Chepauk</span> }));
vi.mock('../components/WeatherPill', () => ({ default: () => null }));
vi.mock('../components/GateActivityPanel', () => ({ default: () => null }));
vi.mock('../components/ApprovalQueue', () => ({ default: () => null }));

describe('OpsDashboard', () => {
  beforeEach(() => {
    nexusContext.useNexus.mockReturnValue({
      stadium: { name: 'Test Stadium', zones: [], crush_threshold: 0.8 },
      densities: {},
      matchState: { score: '0/0', mins_to_halftime: 10, remaining_budget: 1000, over: '5' },
      actions: [],
      loading: false,
      activeStadiumId: 'chepauk',
      setStadiumId: vi.fn(),
      weatherData: null,
      gateData: {}
    });
    firestore.onSnapshot.mockImplementation((docRef, cb) => {
      cb({ data: () => ({ paused: false }) });
      return () => {};
    });
    firestore.doc.mockReturnValue({});
    firestore.setDoc.mockResolvedValue(undefined);
    window.confirm = vi.fn();
  });

  it('Pause toggle writes nexus_state/engine.paused', async () => {
    render(<OpsDashboard />);
    const pauseBtn = screen.getByRole('button', { name: /Pause NEXUS AI engine/i });

    await act(async () => {
      fireEvent.click(pauseBtn);
    });

    expect(firestore.setDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ paused: true }),
      { merge: true }
    );
  });

  it('Emergency button is gated behind window.confirm', async () => {
    window.confirm.mockReturnValue(false);
    render(<OpsDashboard />);

    const emergBtn = screen.getByRole('button', { name: /Trigger emergency broadcast to all fans/i });
    await act(async () => {
      fireEvent.click(emergBtn);
    });

    expect(window.confirm).toHaveBeenCalled();
  });

  it('Pressure index color is danger when above 7.0', () => {
    nexusContext.useNexus.mockReturnValue({
      stadium: { name: 'Test Stadium', zones: [], crush_threshold: 0.8 },
      densities: {
        north_stand: { pct: 0.75 }, south_stand: { pct: 0.72 },
        east_block: { pct: 0.71 }, west_block: { pct: 0.70 }, concourse_a: { pct: 0.74 },
      },
      matchState: { score: '0/0', mins_to_halftime: 10, remaining_budget: 1000, over: '5' },
      actions: [],
      loading: false,
      activeStadiumId: 'chepauk',
      setStadiumId: vi.fn(),
      weatherData: null,
      gateData: {}
    });
    render(<OpsDashboard />);
    const pressureEl = screen.getByText('7.2');
    expect(pressureEl).toHaveStyle({ color: 'var(--danger)' });
  });
});
