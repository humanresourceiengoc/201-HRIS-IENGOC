import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  message: string;
  type?: 'success' | 'error' | 'info' | 'warning';
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
};

const ToastItem: React.FC<{ toast: ToastMessage; onDismiss: (id: string) => void }> = ({ toast, onDismiss }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, 4000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const bg = toast.type === 'success'
    ? 'bg-emerald-800 text-white border-emerald-700'
    : toast.type === 'error'
    ? 'bg-rose-800 text-white border-rose-700'
    : 'bg-slate-900 text-white border-slate-800';

  const icon = toast.type === 'success' ? (
    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
  ) : toast.type === 'error' ? (
    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
  ) : (
    <Info className="w-4 h-4 text-blue-400 shrink-0" />
  );

  return (
    <div className={`pointer-events-auto p-3.5 rounded-xl border shadow-xl flex items-center justify-between gap-3 text-xs font-semibold animate-slide-up ${bg}`}>
      <div className="flex items-center gap-2.5">
        {icon}
        <span>{toast.message}</span>
      </div>
      <button onClick={() => onDismiss(toast.id)} className="p-1 hover:opacity-80 transition-opacity">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
