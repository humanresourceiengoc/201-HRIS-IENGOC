import React from 'react';
import { CompanyKey, UserAccount } from '../types';
import { LayoutDashboard, Users, FileSpreadsheet, UserCog, LogOut, ArrowLeftRight, Calendar, FolderTree, Clock, Landmark, Mail } from 'lucide-react';
import { IenLogo, SebLogo } from './CompanyLogos';

interface SidebarProps {
  company: CompanyKey;
  currentUser: UserAccount;
  activeTab: string;
  onNavigate: (tab: string) => void;
  onLogout: () => void;
  onChangeCompany: () => void;
  onOpenGoogleSheets?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  company,
  currentUser,
  activeTab,
  onNavigate,
  onLogout,
  onChangeCompany,
  onOpenGoogleSheets
}) => {
  const isSeb = company === 'seb';
  const companyName = isSeb ? 'SEB Equipment' : 'IENCC';
  const activeBg = isSeb ? 'bg-teal-50 text-teal-800' : 'bg-blue-50 text-blue-800';
  const activeIcon = isSeb ? 'text-teal-600' : 'text-blue-600';

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'employees', label: 'Employees', icon: Users },
    { id: 'import', label: 'Import & Export', icon: ArrowLeftRight },
    { id: 'attendance', label: 'Attendance Tracker', icon: Clock },
    { id: 'loans', label: 'Gov Loans & Deductions', icon: Landmark },
    { id: 'orgchart', label: 'Org Chart', icon: FolderTree },
    { id: 'calendar', label: 'HR Calendar', icon: Calendar },
    ...(currentUser.role === 'admin'
      ? [{ id: 'users', label: 'Manage Users', icon: UserCog }]
      : [])
  ];

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'U';
  };

  return (
    <aside className="w-64 bg-white border-r border-slate-200 h-screen fixed left-0 top-0 flex flex-col z-30 shadow-sm">
      {/* Brand Header */}
      <div className="p-4 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 p-1 flex items-center justify-center shadow-xs">
            {company === 'seb' ? <SebLogo size={32} /> : <IenLogo size={32} />}
          </div>
          <div>
            <h2 className="font-bold text-slate-900 text-sm leading-tight">{companyName} DB</h2>
            <span className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase">201 HRIS System</span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-semibold text-xs transition-all ${
                isActive
                  ? `${activeBg} shadow-sm font-bold`
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? activeIcon : 'text-slate-400'}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
        {onOpenGoogleSheets && (
          <button
            onClick={onOpenGoogleSheets}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-bold text-xs transition-all text-emerald-700 bg-emerald-50/80 hover:bg-emerald-100/80 border border-emerald-200/80 mt-2 shadow-2xs cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Google Sheet</span>
          </button>
        )}
      </nav>

      {/* Footer User Info */}
      <div className="p-4 border-t border-slate-200 bg-slate-50/50">
        <div className="flex items-center justify-between mb-3 bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-8 h-8 rounded-full ${isSeb ? 'bg-teal-600' : 'bg-blue-600'} text-white font-bold text-xs flex items-center justify-center shrink-0`}>
              {getInitials(currentUser.name)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-900 truncate">{currentUser.name}</p>
              {currentUser.email && (
                <p className="text-[10px] text-slate-500 font-mono truncate flex items-center gap-1 mt-0.5" title={currentUser.email}>
                  <Mail className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                  <span className="truncate">{currentUser.email}</span>
                </p>
              )}
              <div className="flex items-center gap-1 mt-1">
                {currentUser.blocked ? (
                  <span className="text-[9px] px-1.5 py-0.5 bg-rose-100 text-rose-700 font-extrabold rounded-md uppercase tracking-wider">
                    Blocked
                  </span>
                ) : currentUser.role === 'admin' ? (
                  <span className="text-[9px] px-1.5 py-0.5 bg-indigo-100 text-indigo-700 font-extrabold rounded-md uppercase tracking-wider border border-indigo-200">
                    Admin
                  </span>
                ) : (
                  <span className="text-[9px] px-1.5 py-0.5 bg-emerald-100 text-emerald-800 font-extrabold rounded-md uppercase tracking-wider border border-emerald-200">
                    Viewer
                  </span>
                )}
                {currentUser.verificationStatus && currentUser.verificationStatus !== 'approved' && (
                  <span className="text-[9px] px-1.5 py-0.5 bg-amber-100 text-amber-800 font-extrabold rounded-md uppercase tracking-wider">
                    {currentUser.verificationStatus}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onChangeCompany}
            className="w-full py-1.5 px-2 bg-slate-200/80 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold transition-colors flex items-center justify-center gap-1"
            title="Switch company"
          >
            <ArrowLeftRight className="w-3 h-3" /> Switch
          </button>
          <button
            onClick={onLogout}
            className="w-full py-1.5 px-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-[11px] font-bold transition-colors flex items-center justify-center gap-1"
            title="Exit session"
          >
            <LogOut className="w-3 h-3" /> Exit
          </button>
        </div>
      </div>
    </aside>
  );
};
