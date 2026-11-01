import React from 'react';
import { CheckCircle2, Clock, AlertTriangle, Loader2 } from 'lucide-react';

interface StatusBadgeProps {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  stage?: string;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, stage, className = '' }) => {
  switch (status) {
    case 'completed':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 ${className}`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Completed</span>
        </span>
      );
    case 'processing':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 ${className}`}
        >
          <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
          <span>{stage || 'Processing...'}</span>
        </span>
      );
    case 'pending':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30 ${className}`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Pending</span>
        </span>
      );
    case 'failed':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30 ${className}`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Failed</span>
        </span>
      );
    default:
      return null;
  }
};
