import React, { useState, useEffect } from 'react';
import { subscribePendingActions, resolveAction } from '../firebase/collections';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Check, X, Clock } from 'lucide-react';

/**
 * ApprovalQueue — Human-in-the-loop panel for pending high-priority actions.
 * Priority 4-5 actions require human approval before dispatch.
 * 60-second countdown timer per action — auto-escalates if not resolved.
 */
const ApprovalQueue = ({ stadiumId = 'chepauk' }) => {
  const [pendingActions, setPendingActions] = useState([]);

  useEffect(() => {
    const unsub = subscribePendingActions(stadiumId, (actions) => {
      setPendingActions(actions);
    });
    return () => unsub();
  }, [stadiumId]);

  const handleResolve = async (actionId, decision) => {
    try {
      await resolveAction(actionId, decision);
    } catch (err) {
      console.error('Failed to resolve action:', err);
    }
  };

  if (pendingActions.length === 0) {
    return (
      <div className="text-center py-6">
        <div className="text-emerald-400 text-xs font-bold uppercase tracking-widest">
          All clear — no pending approvals
        </div>
        <div className="text-white/10 text-[10px] mt-1">
          All AI decisions are being auto-dispatched
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
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

/**
 * Individual pending action card with countdown timer.
 */
const PendingCard = ({ action, onApprove, onReject }) => {
  const [countdown, setCountdown] = useState(60);
  const [autoEscalated, setAutoEscalated] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          // Auto-escalate: approve by default when timer expires
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
  const priorityColor = action.priority >= 5 ? '#A32D2D' : '#E24B4A';

  return (
    <motion.div
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 20, opacity: 0 }}
      className="glass-card p-4 relative overflow-hidden"
      style={{ borderLeft: `3px solid ${priorityColor}` }}
    >
      {/* Countdown progress bar */}
      <div className="absolute top-0 left-0 h-0.5 bg-white/5 w-full">
        <motion.div
          initial={{ width: '100%' }}
          animate={{ width: `${(countdown / 60) * 100}%` }}
          transition={{ duration: 1, ease: 'linear' }}
          className="h-full"
          style={{
            backgroundColor: isUrgent ? '#E24B4A' : '#EF9F27',
            boxShadow: isUrgent ? '0 0 8px #E24B4A' : 'none'
          }}
        />
      </div>

      {/* Header row */}
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-2">
          <AlertTriangle
            size={14}
            className={isUrgent ? 'text-red-500 animate-pulse' : 'text-amber-400'}
          />
          <span
            className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded"
            style={{ backgroundColor: priorityColor + '20', color: priorityColor }}
          >
            P{action.priority} — {action.stakeholder}
          </span>
        </div>
        <div className="flex items-center gap-1 text-[10px] font-bold tabular-nums" style={{ color: isUrgent ? '#E24B4A' : '#EF9F27' }}>
          <Clock size={10} />
          {countdown}s
        </div>
      </div>

      {/* Action text */}
      <p className="text-xs font-medium text-white/90 leading-tight mb-1">
        {action.action}
      </p>
      <p className="text-[10px] text-white/40 italic mb-3">
        {action.risk_assessment}
      </p>

      {autoEscalated && (
        <div className="mb-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-red-400">
          Auto-escalated
        </div>
      )}

      {/* Approve / Reject buttons */}
      <div className="flex gap-2">
        <button
          onClick={onApprove}
          className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all hover:scale-[1.02] active:scale-95"
          style={{ backgroundColor: '#639922', color: 'white' }}
        >
          <Check size={12} />
          Approve
        </button>
        <button
          onClick={onReject}
          className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all hover:scale-[1.02] active:scale-95"
          style={{ backgroundColor: '#E24B4A', color: 'white' }}
        >
          <X size={12} />
          Reject
        </button>
      </div>
    </motion.div>
  );
};

export default ApprovalQueue;
