import React from 'react';
import { UserRole } from '../types';
import { UserPlus, FileText, Shield, Eye, CheckCircle2, CloudCheck } from 'lucide-react';

interface TopbarProps {
  pageTitle: string;
  userRole: UserRole;
  onOpenAddModal: () => void;
  onOpenBlankForm?: () => void;
  lastSyncTime?: Date | string | null;
}

export const Topbar: React.FC<TopbarProps> = ({
  pageTitle,
  userRole,
  onOpenAddModal,
  onOpenBlankForm,
  lastSyncTime
}) => {
  const formatSyncTime = (time?: Date | string | null) => {
    if (!time) return 'Active';
    const dateObj = typeof time === 'string' ? new Date(time) : time;
    if (isNaN(dateObj.getTime())) return 'Active';
    return dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <header className="sticky top-0 bg-white/90 backdrop-blur-md border-b border-slate-200 px-6 sm:px-8 py-3.5 flex flex-wrap items-center justify-between z-20 shadow-2xs gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">{pageTitle}</h1>
        {userRole === 'admin' ? (
          <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 text-[11px] font-extrabold rounded-full border border-indigo-200/80 flex items-center gap-1.5 shadow-2xs">
            <Shield className="w-3.5 h-3.5 text-indigo-600" />
            ADMIN ACCESS
          </span>
        ) : (
          <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 text-[11px] font-extrabold rounded-full border border-emerald-200/80 flex items-center gap-1.5 shadow-2xs">
            <Eye className="w-3.5 h-3.5 text-emerald-600" />
            VIEWER MODE (Read Only)
          </span>
        )}

        {/* Firestore Sync Timestamp Indicator */}
        <div
          className="px-2.5 py-1 bg-emerald-50/90 text-emerald-800 text-[11px] font-semibold rounded-full border border-emerald-200 flex items-center gap-1.5 shadow-2xs"
          title="Firestore Cloud Database Synchronization Status. Your local changes are saved and synced."
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          <span>Sync Safe: <strong className="font-bold text-emerald-900">{formatSyncTime(lastSyncTime)}</strong></span>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        {onOpenBlankForm && (
          <button
            onClick={onOpenBlankForm}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-slate-100 rounded-xl text-xs font-bold transition-all shadow-sm hover:shadow-md flex items-center gap-2 border border-slate-700 cursor-pointer"
            title="Print blank 201 Employee Personal Data Sheet for new hire onboarding"
          >
            <FileText className="w-4 h-4 text-amber-400" />
            <span>Print Blank 201 Form</span>
          </button>
        )}

        {userRole === 'admin' && (
          <button
            onClick={onOpenAddModal}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md hover:shadow-lg flex items-center gap-2 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Employee</span>
          </button>
        )}
      </div>
    </header>
  );
};

