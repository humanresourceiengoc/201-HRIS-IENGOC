import React, { useState, useEffect } from 'react';
import { CompanyKey, Employee, UserRole } from '../types';
import {
  signInWithGoogleForSheets,
  exportEmployeesToGoogleSheets,
  fetchEmployeesFromGoogleSheet,
  getGoogleAccessToken,
  setGoogleAccessToken,
  getLinkedGoogleSheet,
  unlinkGoogleSheet,
  isAutoSyncEnabled,
  setAutoSyncEnabled,
  LinkedSheetInfo,
  ExportToSheetResult
} from '../lib/googleSheets';
import { saveEmployee } from '../lib/db';
import { FileSpreadsheet, ExternalLink, RefreshCw, Upload, CheckCircle2, AlertCircle, LogOut, Zap } from 'lucide-react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../lib/firebase';

interface GoogleSheetsIntegrationProps {
  company: CompanyKey;
  companyName: string;
  userRole?: UserRole;
  employees: Employee[];
  onRefreshData: () => void;
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

interface ExportHistoryItem {
  id: string;
  title: string;
  url: string;
  date: string;
  count: number;
}

export const GoogleSheetsIntegration: React.FC<GoogleSheetsIntegrationProps> = ({
  company,
  companyName,
  userRole = 'admin',
  employees,
  onRefreshData,
  onToast,
}) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(getGoogleAccessToken());
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isImporting, setIsImporting] = useState<boolean>(false);

  const [linkedSheet, setLinkedSheet] = useState<LinkedSheetInfo | null>(() => getLinkedGoogleSheet(company));
  const [autoSyncOn, setAutoSyncOn] = useState<boolean>(() => isAutoSyncEnabled(company));
  const [lastExport, setLastExport] = useState<ExportToSheetResult | null>(null);
  const [sheetUrlInput, setSheetUrlInput] = useState<string>('');
  const [importPreview, setImportPreview] = useState<Partial<Employee>[]>([]);

  const [exportHistory, setExportHistory] = useState<ExportHistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem(`gsheets_history_${company}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Listen for sync status changes across the app
  useEffect(() => {
    const handleStatusChange = (e: any) => {
      if (!e.detail || e.detail.company === company) {
        setLinkedSheet(getLinkedGoogleSheet(company));
        setAutoSyncOn(isAutoSyncEnabled(company));
      }
    };
    window.addEventListener('gsheets_sync_status_changed', handleStatusChange);
    return () => window.removeEventListener('gsheets_sync_status_changed', handleStatusChange);
  }, [company]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  const saveHistory = (item: ExportHistoryItem) => {
    const updated = [item, ...exportHistory.filter(h => h.id !== item.id).slice(0, 4)];
    setExportHistory(updated);
    try {
      localStorage.setItem(`gsheets_history_${company}`, JSON.stringify(updated));
    } catch (e) {
      console.warn('Could not save history:', e);
    }
  };

  const handleConnectGoogle = async () => {
    setIsAuthenticating(true);
    try {
      const token = await signInWithGoogleForSheets();
      setAccessToken(token);
      onToast('Connected to Google Account successfully! Auto-sync is active.', 'success');
      
      // Perform initial sync automatically upon connect if employees exist
      if (employees.length > 0) {
        setIsSyncing(true);
        const result = await exportEmployeesToGoogleSheets(company, companyName, employees, token);
        setLinkedSheet({
          spreadsheetId: result.spreadsheetId,
          spreadsheetUrl: result.spreadsheetUrl,
          lastSyncedAt: result.lastSyncedAt
        });
        saveHistory({
          id: result.spreadsheetId,
          title: `${companyName.toUpperCase()} Masterlist`,
          url: result.spreadsheetUrl,
          date: new Date().toLocaleString(),
          count: result.rowsCount,
        });
        onToast(`Automatically created & synced ${result.rowsCount} records to Google Sheets!`, 'success');
      }
    } catch (err: any) {
      console.error('Google Sign-In failed:', err);
      onToast(err.message || 'Google Authentication failed. Please try again.', 'error');
    } finally {
      setIsAuthenticating(false);
      setIsSyncing(false);
    }
  };

  const handleManualSyncNow = async (forceNewSheet: boolean = false) => {
    let token = accessToken || getGoogleAccessToken();
    if (!token) {
      try {
        token = await signInWithGoogleForSheets();
        setAccessToken(token);
      } catch (err: any) {
        onToast('Google Authentication required to sync Google Sheets.', 'error');
        return;
      }
    }

    if (employees.length === 0) {
      onToast('No employee records available to sync.', 'warning');
      return;
    }

    setIsSyncing(true);
    try {
      const result = await exportEmployeesToGoogleSheets(company, companyName, employees, token, forceNewSheet);
      setLastExport(result);
      setLinkedSheet({
        spreadsheetId: result.spreadsheetId,
        spreadsheetUrl: result.spreadsheetUrl,
        lastSyncedAt: result.lastSyncedAt
      });

      saveHistory({
        id: result.spreadsheetId,
        title: `${companyName.toUpperCase()} Masterlist`,
        url: result.spreadsheetUrl,
        date: new Date().toLocaleString(),
        count: result.rowsCount,
      });

      onToast(`Updated Google Sheet with ${result.rowsCount} employees!`, 'success');
    } catch (err: any) {
      console.error('Export error:', err);
      if (err.message?.includes('401') || err.message?.includes('token')) {
        setAccessToken(null);
        setGoogleAccessToken(null);
        onToast('Session expired. Please reconnect your Google account.', 'error');
      } else {
        onToast(err.message || 'Failed to sync Google Sheets.', 'error');
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handleToggleAutoSync = () => {
    const nextVal = !autoSyncOn;
    setAutoSyncOn(nextVal);
    setAutoSyncEnabled(company, nextVal);
    if (nextVal) {
      onToast('Automatic Google Sheets real-time sync is now ENABLED.', 'success');
    } else {
      onToast('Automatic Google Sheets real-time sync paused.', 'info');
    }
  };

  const handleFetchFromSheet = async () => {
    if (!sheetUrlInput.trim()) {
      onToast('Please enter a valid Google Sheet URL or Spreadsheet ID.', 'warning');
      return;
    }

    let token = accessToken || getGoogleAccessToken();
    if (!token) {
      try {
        token = await signInWithGoogleForSheets();
        setAccessToken(token);
      } catch (err: any) {
        onToast('Google Authentication required to access Google Sheets.', 'error');
        return;
      }
    }

    setIsImporting(true);
    try {
      const importedRows = await fetchEmployeesFromGoogleSheet(sheetUrlInput, token);
      setImportPreview(importedRows);
      onToast(`Fetched ${importedRows.length} employee records from Google Sheet for review.`, 'info');
    } catch (err: any) {
      console.error('Fetch error:', err);
      onToast(err.message || 'Could not fetch data from Google Sheet. Check permissions and range.', 'error');
    } finally {
      setIsImporting(false);
    }
  };

  const handleConfirmSheetImport = () => {
    if (importPreview.length === 0) return;

    let count = 0;
    importPreview.forEach(emp => {
      saveEmployee(company, {
        empId: emp.empId || `EMP-${Date.now()}-${Math.floor(Math.random()*1000)}`,
        lastName: emp.lastName || 'Unknown',
        firstName: emp.firstName || 'Unknown',
        middleName: emp.middleName || '',
        suffix: emp.suffix || '',
        department: emp.department || '',
        position: emp.position || '',
        division: emp.division || '',
        locationBranch: emp.locationBranch || 'Mandaluyong',
        status: emp.status || 'ACTIVE',
        classification: emp.classification || 'Regular',
        dateHired: emp.dateHired || '',
        mobileNumber: emp.mobileNumber || '',
        companyEmail: emp.companyEmail || '',
        personalEmail: emp.personalEmail || '',
        sss: emp.sss || '',
        pagibig: emp.pagibig || '',
        philhealth: emp.philhealth || '',
        tin: emp.tin || '',
        bankName: emp.bankName || 'BDO',
        bankAccountNumber: emp.bankAccountNumber || '',
        birthdate: emp.birthdate || '',
        civilStatus: emp.civilStatus || 'Single',
        gender: emp.gender || 'Male',
        currentAddress: emp.currentAddress || '',
        emergencyName: emp.emergencyName || '',
        emergencyRelation: emp.emergencyRelation || '',
        emergencyContact: emp.emergencyContact || '',
      });
      count++;
    });

    setImportPreview([]);
    setSheetUrlInput('');
    onRefreshData();
    onToast(`Successfully synced ${count} employees from Google Sheet into HRIS!`, 'success');
  };

  return (
    <div className="bg-slate-900 text-white rounded-2xl p-5 border border-slate-800 shadow-xl space-y-5">
      {/* Top Header & Account Status */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-extrabold text-base text-white flex items-center gap-2">
              Google Sheets Real-Time Sync
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase tracking-wide flex items-center gap-1">
                <Zap className="w-3 h-3 text-emerald-400 animate-pulse" /> Automatic Sync
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              No need to export manually! Any changes in HRIS automatically update your linked Google Sheet in real-time.
            </p>
          </div>
        </div>

        {/* Account Status / Connect Button */}
        <div className="flex items-center gap-2">
          {accessToken ? (
            <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700 text-xs text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="font-medium truncate max-w-[150px]">
                {currentUser?.email || 'Google Drive Connected'}
              </span>
              <button
                onClick={() => {
                  setAccessToken(null);
                  setGoogleAccessToken(null);
                  onToast('Disconnected from Google Account.', 'info');
                }}
                className="text-slate-400 hover:text-rose-400 transition-colors ml-1"
                title="Disconnect Google Account"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={handleConnectGoogle}
              disabled={isAuthenticating}
              className="gsi-material-button text-xs font-bold px-3 py-2 bg-white text-slate-800 hover:bg-slate-100 rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
            >
              <svg className="w-4 h-4" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
              </svg>
              <span>{isAuthenticating ? 'Connecting...' : 'Connect Google Drive'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Automatic Sync Banner & Live Sheet Card */}
      <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${autoSyncOn && accessToken ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`}></span>
            <div>
              <div className="text-sm font-extrabold text-emerald-300 flex items-center gap-2">
                {autoSyncOn && accessToken ? 'Automatic Live Sync: ACTIVE' : 'Automatic Sync Ready'}
              </div>
              <p className="text-xs text-slate-300">
                {autoSyncOn && accessToken
                  ? 'All changes in HRIS (Adding, Editing, Deleting employees) are automatically saved into Google Sheets.'
                  : 'Connect your Google Drive once to enable continuous real-time Google Sheets background syncing.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-200">
              <span>Auto-Sync</span>
              <input
                type="checkbox"
                checked={autoSyncOn}
                onChange={handleToggleAutoSync}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500 relative"></div>
            </label>

            <button
              onClick={() => handleManualSyncNow(false)}
              disabled={isSyncing}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
            </button>
          </div>
        </div>

        {/* Display Linked Sheet Info if available */}
        {linkedSheet && (
          <div className="pt-2 border-t border-emerald-500/20 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-emerald-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Linked Google Sheet: <strong>{companyName} Masterlist</strong> ({employees.length} records)</span>
              {linkedSheet.lastSyncedAt && (
                <span className="text-[11px] text-slate-400">
                  • Last synced at {linkedSheet.lastSyncedAt}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <a
                href={linkedSheet.spreadsheetUrl}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1 bg-emerald-500 text-slate-950 font-extrabold hover:bg-emerald-400 rounded-lg flex items-center gap-1 text-xs transition-colors"
              >
                Open Google Sheet <ExternalLink className="w-3.5 h-3.5" />
              </a>

              <button
                onClick={() => handleManualSyncNow(true)}
                className="text-[11px] text-slate-400 hover:text-white underline cursor-pointer"
                title="Create a new fresh Google Sheet instead of updating existing"
              >
                Create New File
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Manual Pull / Import Section */}
      <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/60 space-y-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-blue-400 font-bold text-sm">
            <Upload className="w-4 h-4" />
            <span>Pull Data From Existing Google Sheet</span>
          </div>
          <p className="text-xs text-slate-300">
            If you have an existing Google Sheet, paste its URL or Spreadsheet ID below to import records into HRIS.
          </p>
        </div>

        <div className="flex gap-2 pt-1">
          <input
            type="text"
            placeholder="Paste Google Sheet URL or Spreadsheet ID..."
            value={sheetUrlInput}
            onChange={(e) => setSheetUrlInput(e.target.value)}
            className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={handleFetchFromSheet}
            disabled={isImporting}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1 cursor-pointer disabled:opacity-50"
          >
            {isImporting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Fetch & Review'}
          </button>
        </div>
      </div>

      {/* Import Preview Modal / Box if rows fetched */}
      {importPreview.length > 0 && (
        <div className="p-3 bg-slate-800 rounded-xl border border-blue-500/30 space-y-3 animate-fadeIn">
          <div className="flex items-center justify-between text-xs font-bold text-slate-200">
            <span className="flex items-center gap-1.5 text-blue-300">
              <CheckCircle2 className="w-4 h-4" /> Ready to sync {importPreview.length} records from Google Sheet
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleConfirmSheetImport}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1"
              >
                Confirm & Import to HRIS
              </button>
              <button
                onClick={() => setImportPreview([])}
                className="px-2.5 py-1.5 bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-bold"
              >
                Cancel
              </button>
            </div>
          </div>

          <div className="overflow-x-auto max-h-40 border border-slate-700 rounded-lg bg-slate-900">
            <table className="w-full text-left text-[11px] text-slate-300">
              <thead>
                <tr className="bg-slate-800 border-b border-slate-700 font-bold text-slate-200">
                  <th className="p-2">Emp ID</th>
                  <th className="p-2">Name</th>
                  <th className="p-2">Department</th>
                  <th className="p-2">Position</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">SSS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {importPreview.slice(0, 5).map((row, idx) => (
                  <tr key={idx}>
                    <td className="p-2 font-mono text-emerald-400">{row.empId || 'N/A'}</td>
                    <td className="p-2 font-semibold">{row.firstName} {row.lastName}</td>
                    <td className="p-2">{row.department || '—'}</td>
                    <td className="p-2">{row.position || '—'}</td>
                    <td className="p-2">{row.status || 'ACTIVE'}</td>
                    <td className="p-2 font-mono">{row.sss || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Export History / Recent Google Sheets */}
      {exportHistory.length > 0 && (
        <div className="pt-2 border-t border-slate-800/80 space-y-2">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Recent Google Sheets Created
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {exportHistory.map(item => (
              <a
                key={item.id}
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="p-2.5 bg-slate-800/40 hover:bg-slate-800 rounded-xl border border-slate-700/50 flex items-center justify-between text-xs transition-all group"
              >
                <div className="truncate pr-2">
                  <div className="font-bold text-slate-200 group-hover:text-emerald-400 truncate">
                    {item.title}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {item.count} records • {item.date}
                  </div>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-400 shrink-0" />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
