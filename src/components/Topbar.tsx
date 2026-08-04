import React from 'react';
import { UserRole } from '../types';
import { UserPlus, FileText, Shield, Eye } from 'lucide-react';

interface TopbarProps {
  pageTitle: string;
  userRole: UserRole;
  onOpenAddModal: () => void;
  onOpenBlankForm?: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({ pageTitle, userRole, onOpenAddModal, onOpenBlankForm }) => {
  return (
    <header className="sticky top-0 bg-white/90 backdrop-blur-md border-b border-slate-200 px-6 sm:px-8 py-3.5 flex flex-wrap items-center justify-between z-20 shadow-2xs gap-3">
      <div className="flex items-center gap-3">
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

