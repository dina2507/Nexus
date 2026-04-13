import React, { useState, useEffect } from 'react';
import { subscribePendingActions, resolveAction } from '../firebase/collections';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Check, X, Clock } from 'lucide-react';

const ApprovalQueue = ({ stadiumId = 'chepauk' }) => {
  const [pendingActions, setPendingActions] = useState([]);

  useEffect(() => {
    const unsub = subscribePendingActions(stadiumId, (actions) => setPendingActions(actions));
    return () => unsub();
  }, [stadiumId]);

  const handleResolve = async (actionId, decision) => {
    try { await resolveAction(actionId, decision); }
    catch (err) { console.error('Failed to resolve action:', err); }
  };

  if (pendingActions.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '20px 12px' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          padding: '6px 14px', borderRadius: '99px',
          background: 'var(--success-dim)',
          border: '1px solid rgba(16,185,129,0.2)',
        }}>
          <span className="status-dot live" />
          <span style={{ fontSize: '11px', fontWeight: 600, color: '#6ee7b7' }}>
            All clear — no pending approvals
          </span>
        </div>
        <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '6px' }}>
          AI decisions are auto-dispatching
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <AnimatePresence initial={false}>
        {pendingActions.map((action) => (
          <PendingCard
            key={action.id}
            action={action}
            onApprove={() => handleResolve(action.id, 'approved')}
            onReject={() => handleResolve(action.id, 'rejected')}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};

const PendingCard = ({ action, onApprove, onReject }) => {
  const [countdown, setCountdown] = useState(60);
  const [autoEscalated, setAutoEscalated] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setAutoEscalated(true);
          onApprove();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const isUrgent = countdown <= 15;

  return (
    <motion.div
      initial={{ x: -16, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 16, opacity: 0 }}
      style={{
        background: 'var(--bg-surface)',
        border: `1px solid ${isUrgent ? 'rgba(239,68,68,0.35)' : 'var(--border-subtle)'}`,
        borderRadius: '10px',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Countdown progress bar (top edge) */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'rgba(255,255,255,0.04)' }}>
        <motion.div
          initial={{ width: '100%' }}
          animate={{ width: `${(countdown / 60) * 100}%` }}
          transition={{ duration: 1, ease: 'linear' }}
          style={{ height: '100%', background: isUrgent ? 'var(--danger)' : 'var(--warning)', borderRadius: '99px' }}
        />
      </div>

      <div style={{ padding: '14px 14px 0' }}>
        {/* Header row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
            <AlertTriangle
              size={13}
              style={{ color: isUrgent ? 'var(--danger)' : 'var(--warning)', animation: isUrgent ? 'pulse 1.2s ease infinite' : 'none' }}
            />
            <span className={`badge ${action.priority >= 5 ? 'badge-red' : 'badge-amber'}`}>
              P{action.priority} · {action.stakeholder}
            </span>
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '3px',
            fontSize: '11px', fontWeight: 700,
            color: isUrgent ? 'var(--danger)' : 'var(--warning)',
            fontVariantNumeric: 'tabular-nums',
          }}>
            <Clock size={10} />
            {countdown}s
          </div>
        </div>

        {/* Action text */}
        <p style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.5, margin: '0 0 4px' }}>
          {action.action}
        </p>
        <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', margin: '0 0 12px', lineHeight: 1.4 }}>
          {action.risk_assessment}
        </p>

        {autoEscalated && (
          <div style={{
            marginBottom: '10px', padding: '6px 10px', borderRadius: '6px',
            background: 'var(--danger-dim)', border: '1px solid rgba(239,68,68,0.2)',
            fontSize: '10px', fontWeight: 600, color: '#fca5a5',
          }}>
            Auto-escalated — timer expired
          </div>
        )}
      </div>

      {/* Approve / Reject */}
      <div style={{ display: 'flex', gap: '8px', padding: '0 14px 14px' }}>
        <button className="btn-primary" style={{ flex: 1 }} onClick={onApprove}>
          <Check size={12} /> Approve
        </button>
        <button className="btn-danger" style={{ flex: 1 }} onClick={onReject}>
          <X size={12} /> Reject
        </button>
      </div>
    </motion.div>
  );
};

export default ApprovalQueue;
