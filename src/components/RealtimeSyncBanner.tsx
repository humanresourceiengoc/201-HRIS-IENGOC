import React, { useState } from 'react';
import { CollaboratorPresence } from '../types';
import { getDeletedUserEmails } from '../lib/db';
import { Wifi, Users, Globe, Smartphone, Monitor, Shield, Ban, Eye, RefreshCw } from 'lucide-react';

interface RealtimeSyncBannerProps {
  presenceList: CollaboratorPresence[];
  currentUserId?: string;
  onOpenSyncModal?: () => void;
  onManualSync?: () => void;
  isSyncing?: boolean;
}

export const RealtimeSyncBanner: React.FC<RealtimeSyncBannerProps> = ({
  presenceList,
  currentUserId,
  onOpenSyncModal,
  onManualSync,
  isSyncing = false
}) => {
  const [showUsersModal, setShowUsersModal] = useState(false);
  const deletedEmails = getDeletedUserEmails();
  const visiblePresence = presenceList.filter(
    p => !p.email || !deletedEmails.includes(p.email.toLowerCase())
  );

  const getBrowserIcon = (browser: string, deviceType: string) => {
    if (deviceType === 'Mobile' || deviceType === 'Tablet') {
      return <Smartphone className="w-3.5 h-3.5 text-emerald-600" />;
    }
    if (browser === 'Edge') {
      return <Globe className="w-3.5 h-3.5 text-blue-600" />;
    }
    return <Monitor className="w-3.5 h-3.5 text-indigo-600" />;
  };

  return (
    <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 border-b border-emerald-200 px-4 py-2 text-xs text-slate-700 print:hidden relative">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
        {/* Left side: Live Sync Indicator */}
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <span className="font-semibold text-emerald-800 flex items-center gap-1.5">
            <Wifi className="w-3.5 h-3.5 text-emerald-600" />
            Firestore Real-Time Sync
          </span>
          <span className="hidden sm:inline text-slate-500">|</span>
          <span className="hidden sm:inline text-slate-600">
            <strong>onSnapshot()</strong> Active &bull; Multi-Device Live Sync (Laptop & PC)
          </span>
        </div>

        {/* Right side: Connected Browsers & Manual Cloud Sync Button */}
        <div className="flex items-center gap-2">
          {onManualSync && (
            <button
              type="button"
              onClick={onManualSync}
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-full shadow-xs transition-all cursor-pointer border border-emerald-500 text-[11px]"
              title="Force sync all local records to Firestore Cloud Database to equalize Laptop and PC data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing Devices...' : 'Sync Laptop & PC Data'}</span>
            </button>
          )}

          {/* Connected browsers / devices badges */}
          <button
            type="button"
            onClick={() => setShowUsersModal(!showUsersModal)}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-200 rounded-full shadow-xs transition-colors cursor-pointer"
          >
            <Users className="w-3.5 h-3.5 text-slate-600" />
            <span className="font-semibold text-slate-800">
              {visiblePresence.length} Connected {visiblePresence.length === 1 ? 'Browser' : 'Browsers'}
            </span>
            <div className="flex -space-x-1 overflow-hidden ml-1">
              {visiblePresence.slice(0, 4).map((p) => {
                const isAdmin = p.role === 'admin';
                const isBlocked = p.blocked;
                return (
                  <div
                    key={p.id}
                    title={`${p.name} (${p.email}) - ${isAdmin ? 'ADMIN' : 'VIEWER'} - ${p.browser} on ${p.deviceType}`}
                    className={`inline-flex items-center justify-center w-6 h-6 rounded-full bg-white border-2 shadow-xs text-[10px] font-bold ${
                      isBlocked
                        ? 'border-rose-500 text-rose-700 bg-rose-50'
                        : isAdmin
                        ? 'border-indigo-600 text-indigo-700 bg-indigo-50'
                        : 'border-emerald-500 text-emerald-700 bg-emerald-50'
                    }`}
                  >
                    {p.name ? p.name.charAt(0).toUpperCase() : 'U'}
                  </div>
                );
              })}
            </div>
          </button>
        </div>
      </div>

      {/* Connected Active Browsers Modal Popover */}
      {showUsersModal && (
        <div className="mt-3 p-4 bg-white rounded-2xl border border-slate-300 shadow-xl max-w-xl ml-auto text-xs space-y-3 z-30 relative animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <h4 className="font-bold text-slate-800 flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-600" />
              Connected Browsers & Users ({visiblePresence.length})
            </h4>
            <button
              onClick={() => setShowUsersModal(false)}
              className="text-slate-400 hover:text-slate-600 font-bold px-1.5 py-0.5 rounded-md hover:bg-slate-100"
            >
              ✕
            </button>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {visiblePresence.length === 0 ? (
              <p className="text-slate-500 py-2 text-center italic">No active browser connections recorded.</p>
            ) : (
              visiblePresence.map((p) => {
                const isOwnerEmail = p.email && (p.email.toLowerCase() === 'humanresource.iengoc@gmail.com' || p.email.toLowerCase() === 'admn.iencc@gmail.com');
                const isAdmin = isOwnerEmail || (p.role === 'admin' && isOwnerEmail);
                const isBlocked = p.blocked;
                const isMe = p.id === currentUserId;
                return (
                  <div
                    key={p.id}
                    className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 ${
                      isMe ? 'bg-blue-50/80 border-blue-200' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 rounded-lg bg-white border border-slate-200">
                        {getBrowserIcon(p.browser, p.deviceType)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{p.name || 'User'}</span>
                          {isMe && <span className="text-[10px] px-1.5 py-0.2 bg-blue-100 text-blue-700 font-bold rounded-md">THIS BROWSER</span>}
                        </div>
                        <span className="text-[11px] text-slate-500 block">{p.email}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                        isBlocked
                          ? 'bg-rose-100 text-rose-700 border border-rose-300'
                          : isAdmin
                          ? 'bg-indigo-100 text-indigo-700 border border-indigo-300'
                          : 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                      }`}>
                        {isBlocked ? <Ban className="w-3 h-3" /> : isAdmin ? <Shield className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        {isBlocked ? 'BLOCKED' : isAdmin ? 'ADMIN' : 'VIEWER'}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {p.browser} ({p.deviceType})
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
