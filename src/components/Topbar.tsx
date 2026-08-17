import React from 'react';
import { UserRole } from '../types';
import { UserPlus, FileText, Shield, Eye, CheckCircle2, FileSpreadsheet, Cloud, Mail } from 'lucide-react';

interface TopbarProps {
  pageTitle: string;
  userRole: UserRole;
  userEmail?: string;
  onOpenAddModal: () => void;
  onOpenBlankForm?: () => void;
  onOpenGoogleSheetModal?: () => void;
  lastSyncTime?: Date | string | null;
}

export const Topbar: React.FC<TopbarProps> = ({
  pageTitle,
  userRole,
  userEmail,
  onOpenAddModal,
  onOpenBlankForm,
  onOpenGoogleSheetModal,
  lastSyncTime
}) => {
  const formatSyncTime = (time?: Date | string | null) => {
    if (!time) return 'Live';
    const dateObj = typeof time === 'string' ? new Date(time) : time;
    if (isNaN(dateObj.getTime())) return 'Live';
    return dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <header className="sticky top-0 bg-white/95 backdrop-blur-md border-b border-slate-200 px-6 sm:px-8 py-3.5 flex flex-wrap items-center justify-between z-20 shadow-xs gap-3">
      {/* Left Section: Title & Status Badges */}
      <div className="flex flex-wrap items-center gap-2.5">
        <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">{pageTitle}</h1>
        
        {userRole === 'admin' ? (
          <span className="h-7 px-2.5 bg-indigo-50 text-indigo-700 text-[11px] font-extrabold rounded-full border border-indigo-200 flex items-center gap-1.5 shadow-2xs">
            <Shield className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <span>ADMIN ACCESS</span>
          </span>
        ) : (
          <span className="h-7 px-2.5 bg-emerald-50 text-emerald-700 text-[11px] font-extrabold rounded-full border border-emerald-200 flex items-center gap-1.5 shadow-2xs">
            <Eye className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>VIEWER MODE</span>
          </span>
        )}

        {/* User Account / Gmail Badge */}
        {userEmail && (
          <div
            className="h-7 px-2.5 bg-slate-100 text-slate-700 text-[11px] font-bold rounded-full border border-slate-200 flex items-center gap-1.5 shadow-2xs"
            title={`Logged in as ${userEmail}`}
          >
            <Mail className="w-3.5 h-3.5 text-rose-500 shrink-0" />
            <span className="font-mono truncate max-w-[200px]">{userEmail}</span>
          </div>
        )}

        {/* Permanent Firestore Cloud Database Indicator */}
        <div
          className="h-7 px-2.5 bg-blue-50 text-blue-900 text-[11px] font-bold rounded-full border border-blue-200 flex items-center gap-1.5 shadow-2xs"
          title="All employees, records, and files are permanently saved to Firebase Cloud Firestore across devices."
        >
          <Cloud className="w-3.5 h-3.5 text-blue-600 shrink-0" />
          <span>Cloud: <strong className="font-extrabold text-blue-700">Firestore</strong></span>
        </div>

        {/* Sync Status */}
        <div
          className="h-7 px-2.5 bg-emerald-50 text-emerald-800 text-[11px] font-semibold rounded-full border border-emerald-200 flex items-center gap-1.5 shadow-2xs"
          title="Real-time multi-device sync timestamp"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>Synced: <strong className="font-bold text-emerald-900">{formatSyncTime(lastSyncTime)}</strong></span>
        </div>
      </div>

      {/* Right Section: Action Buttons */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Dedicated Google Sheet Button */}
        {onOpenGoogleSheetModal && (
          <button
            onClick={onOpenGoogleSheetModal}
            className="h-9 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold transition-all shadow-2xs hover:shadow-sm flex items-center gap-2 border border-emerald-700 cursor-pointer"
            title="Open or configure Google Sheets Masterlist Sync"
          >
            <FileSpreadsheet className="w-4 h-4 text-white" />
            <span>Google Sheet</span>
          </button>
        )}

        {onOpenBlankForm && (
          <button
            onClick={onOpenBlankForm}
            className="h-9 px-3.5 bg-slate-800 hover:bg-slate-900 text-slate-100 rounded-xl text-xs font-bold transition-all shadow-2xs hover:shadow-sm flex items-center gap-2 border border-slate-700 cursor-pointer"
            title="Print blank 201 Employee Personal Data Sheet for new hire onboarding"
          >
            <FileText className="w-4 h-4 text-amber-400" />
            <span>Print Blank 201</span>
          </button>
        )}

        {userRole === 'admin' && (
          <button
            onClick={onOpenAddModal}
            className="h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm hover:shadow-md flex items-center gap-2 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Employee</span>
          </button>
        )}
      </div>
    </header>
  );
};


