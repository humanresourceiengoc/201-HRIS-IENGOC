import React, { useState, useEffect } from 'react';
import { CompanyKey, Employee, UserRole } from '../types';
import {
  exportEmployeesToGoogleSheets,
  signInWithGoogleForSheets,
  fetchEmployeesFromGoogleSheet,
  getGoogleAccessToken,
  setGoogleAccessToken,
  getLinkedGoogleSheet,
  unlinkGoogleSheet,
  isAutoSyncEnabled,
  setAutoSyncEnabled,
  getAppsScriptUrl,
  setAppsScriptUrl,
  syncViaAppsScript,
  LinkedSheetInfo,
  ExportToSheetResult
} from '../lib/googleSheets';
import { saveEmployee } from '../lib/db';
import { FileSpreadsheet, ExternalLink, RefreshCw, Upload, CheckCircle2, AlertCircle, LogOut, Zap, Code, Copy, Check, Link } from 'lucide-react';
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
  userRole,
  employees,
  onRefreshData,
  onToast
}) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(getGoogleAccessToken());
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isImporting, setIsImporting] = useState<boolean>(false);

  const [appsScriptUrlInput, setAppsScriptUrlInput] = useState<string>(() => getAppsScriptUrl(company) || '');
  const [activeScriptUrl, setActiveScriptUrl] = useState<string | null>(() => getAppsScriptUrl(company));
  const [showScriptModal, setShowScriptModal] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [originError, setOriginError] = useState<string | null>(null);

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
        setActiveScriptUrl(getAppsScriptUrl(company));
      }
    };
    window.addEventListener('gsheets_sync_status_changed', handleStatusChange);
    return () => window.removeEventListener('gsheets_sync_status_changed', handleStatusChange);
  }, [company]);


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
    setOriginError(null);
    try {
      const token = await signInWithGoogleForSheets();
      setAccessToken(token);
      onToast('Connected to Google Account successfully! Auto-sync is active.', 'success');
      
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
      console.info('Google Sign-In popup notice:', err.message || err);
      const isPopupOrOriginIssue = 
        err.message?.includes('ORIGIN_MISMATCH') || 
        err.message?.includes('origin') || 
        err.message?.includes('popup') || 
        err.message?.includes('closed') || 
        err.message?.includes('blocked') ||
        err.message?.includes('auth/');

      if (isPopupOrOriginIssue) {
        setOriginError(err.message || 'Google OAuth popup was closed or blocked by browser.');
        setShowScriptModal(true);
        onToast('Google OAuth popup was blocked or requires domain setup. Opened 1-Click Apps Script setup below!', 'info');
      } else {
        onToast(err.message || 'Google Authentication failed. Please try the Apps Script Web App method below.', 'error');
      }
    } finally {
      setIsAuthenticating(false);
      setIsSyncing(false);
    }
  };

  const handleManualSyncNow = async (forceNewSheet: boolean = false) => {
    if (employees.length === 0) {
      onToast('No employee records available to sync.', 'warning');
      return;
    }

    setIsSyncing(true);

    // Option A: Use Apps Script Web App if active
    if (activeScriptUrl) {
      try {
        const result = await syncViaAppsScript(company, companyName, employees, activeScriptUrl);
        setLastExport(result);
        setLinkedSheet({
          spreadsheetId: 'apps_script_linked',
          spreadsheetUrl: activeScriptUrl,
          lastSyncedAt: result.lastSyncedAt
        });
        onToast(`Successfully synced ${result.rowsCount} employees to Google Sheet via Web App!`, 'success');
        return;
      } catch (err: any) {
        console.error('Apps Script Sync Error:', err);
        onToast(`Apps Script sync failed: ${err.message}`, 'error');
      } finally {
        setIsSyncing(false);
      }
    }

    // Option B: OAuth / Google Sheets API
    let token = accessToken || getGoogleAccessToken();
    if (!token) {
      try {
        token = await signInWithGoogleForSheets();
        setAccessToken(token);
      } catch (err: any) {
        if (err.message?.includes('ORIGIN_MISMATCH')) {
          setOriginError(err.message);
          setShowScriptModal(true);
        } else {
          onToast('Google Authentication required to sync Google Sheets.', 'error');
        }
        setIsSyncing(false);
        return;
      }
    }

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

  const handleSaveAppsScriptUrl = () => {
    if (!appsScriptUrlInput.trim()) {
      setAppsScriptUrl(company, null);
      setActiveScriptUrl(null);
      onToast('Cleared Google Apps Script Web App link.', 'info');
      return;
    }
    if (!appsScriptUrlInput.trim().startsWith('http')) {
      onToast('Please enter a valid Web App URL starting with https://script.google.com/...', 'warning');
      return;
    }

    setAppsScriptUrl(company, appsScriptUrlInput.trim());
    setActiveScriptUrl(appsScriptUrlInput.trim());
    onToast('Google Apps Script Web App URL saved! Performing test sync...', 'success');
    
    // Test sync immediately
    if (employees.length > 0) {
      handleManualSyncNow(false);
    }
  };

  const sampleAppsScriptCode = `function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('201 Masterlist') || ss.getActiveSheet();
    sheet.clear();
    
    var headers = [
      'Emp ID', 'Full Name', 'Company', 'Position', 'Department',
      'Employment Status', 'Basic Salary', 'SSS No', 'PhilHealth No',
      'Pag-IBIG No', 'TIN No', 'Contact No', 'Email', 'Address'
    ];
    sheet.appendRow(headers);
    
    (payload.employees || []).forEach(function(emp) {
      sheet.appendRow([
        emp.id || '',
        emp.fullName || '',
        emp.company || '',
        emp.position || '',
        emp.department || '',
        emp.status || '',
        emp.basicSalary || 0,
        emp.sssNo || '',
        emp.philHealthNo || '',
        emp.pagIbigNo || '',
        emp.tinNo || '',
        emp.contactNo || '',
        emp.email || '',
        emp.address || ''
      ]);
    });
    
    return ContentService.createTextOutput(JSON.stringify({ status: 'success', count: payload.employees.length }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}`;

  const copyAppsScriptCode = () => {
    navigator.clipboard.writeText(sampleAppsScriptCode);
    setCopiedCode(true);
    onToast('Google Apps Script code copied to clipboard!', 'success');
    setTimeout(() => setCopiedCode(false), 2500);
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

  const isSyncActive = autoSyncOn && (accessToken || activeScriptUrl);

  return (
    <div className="bg-slate-900 text-white rounded-2xl p-5 border border-slate-800 shadow-xl space-y-5">
      {/* Top Header & Connection Options */}
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
              No manual export needed! Any employee updates in HRIS immediately sync to your Google Sheet in real-time.
            </p>
          </div>
        </div>

        {/* Account Status / Connect Options */}
        <div className="flex items-center gap-2">
          {activeScriptUrl ? (
            <div className="flex items-center gap-2 bg-emerald-950/60 px-3 py-1.5 rounded-xl border border-emerald-500/40 text-xs text-emerald-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="font-bold">Apps Script Web App Connected</span>
              <button
                onClick={() => {
                  setAppsScriptUrl(company, null);
                  setActiveScriptUrl(null);
                  onToast('Disconnected Google Apps Script Web App.', 'info');
                }}
                className="text-slate-400 hover:text-rose-400 transition-colors ml-1"
                title="Disconnect Web App"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : accessToken ? (
            <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700 text-xs text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="font-medium truncate max-w-[150px]">
                {currentUser?.email || 'Google Drive Connected'}
              </span>
              <button
                onClick={() => {
                  setAccessToken(null);
                  setGoogleAccessToken(null);
                  onToast('Disconnected Google Account.', 'info');
                }}
                className="text-slate-400 hover:text-rose-400 transition-colors ml-1"
                title="Disconnect Google Account"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowScriptModal(true)}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                <Code className="w-4 h-4" /> 1-Click Apps Script Setup
              </button>
              <button
                onClick={handleConnectGoogle}
                disabled={isAuthenticating}
                className="gsi-material-button text-xs font-bold px-3 py-1.5 bg-white text-slate-800 hover:bg-slate-100 rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
              >
                <svg className="w-4 h-4" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                </svg>
                <span>{isAuthenticating ? 'Connecting...' : 'Connect OAuth'}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Automatic Sync Banner & Live Sheet Control */}
      <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${isSyncActive ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`}></span>
            <div>
              <div className="text-sm font-extrabold text-emerald-300 flex items-center gap-2">
                {isSyncActive ? 'Automatic Real-Time Sync: ACTIVE' : 'Automatic Real-Time Sync Ready'}
              </div>
              <p className="text-xs text-slate-300">
                {isSyncActive
                  ? 'All changes in HRIS (Adding, Editing, Deleting employees) automatically update your linked Google Sheet in real-time.'
                  : 'Link your Google Sheet via Google Apps Script or Google Drive to activate continuous background sync.'}
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
              {linkedSheet.spreadsheetUrl.startsWith('http') && (
                <a
                  href={linkedSheet.spreadsheetUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1 bg-emerald-500 text-slate-950 font-extrabold hover:bg-emerald-400 rounded-lg flex items-center gap-1 text-xs transition-colors"
                >
                  Open Google Sheet <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}

              <button
                onClick={() => handleManualSyncNow(true)}
                className="text-[11px] text-slate-400 hover:text-white underline cursor-pointer"
                title="Create a new fresh Google Sheet instead of updating existing"
              >
                Re-Create Sheet
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Google Apps Script Web App Connection Form */}
      <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/60 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-blue-400 font-bold text-sm">
            <Link className="w-4 h-4" />
            <span>Direct Google Sheet Web App Link (Recommended - 100% Reliable)</span>
          </div>
          <button
            onClick={() => setShowScriptModal(true)}
            className="text-xs text-blue-300 hover:underline flex items-center gap-1 font-bold"
          >
            <Code className="w-3.5 h-3.5" /> View Setup Instructions
          </button>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Paste your Google Apps Script Web App URL (https://script.google.com/macros/s/.../exec)"
            value={appsScriptUrlInput}
            onChange={(e) => setAppsScriptUrlInput(e.target.value)}
            className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
          />
          <button
            onClick={handleSaveAppsScriptUrl}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer shadow-md"
          >
            Save & Connect
          </button>
        </div>
      </div>

      {/* Modal / Setup Drawer for Google Apps Script Web App */}
      {showScriptModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <Code className="w-5 h-5 text-emerald-400" />
                Setup Google Sheet Direct Real-Time Webhook (3 Easy Steps)
              </h3>
              <button
                onClick={() => setShowScriptModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {originError && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-200 text-xs space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-amber-400" />
                  OAuth Origin Note:
                </div>
                <p className="leading-relaxed">
                  Direct OAuth popup requires domain registration in Google Cloud Console. The <strong>Google Apps Script Web App</strong> below connects directly to your Google Sheet without requiring any domain registration or OAuth setup!
                </p>
              </div>
            )}

            <div className="space-y-3 text-slate-300">
              <div className="flex gap-3 items-start">
                <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-300 font-black flex items-center justify-center shrink-0 border border-emerald-500/40">1</span>
                <div>
                  <h4 className="font-bold text-white text-xs">Open your Google Sheet</h4>
                  <p className="text-slate-400">Open any existing Google Sheet (or create a new one at sheet.new) and click <strong>Extensions &gt; Apps Script</strong> in the top menu.</p>
                </div>
              </div>

              <div className="flex gap-3 items-start">
                <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-300 font-black flex items-center justify-center shrink-0 border border-emerald-500/40">2</span>
                <div className="w-full space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-white text-xs">Paste this Apps Script Code</h4>
                    <button
                      onClick={copyAppsScriptCode}
                      className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-all"
                    >
                      {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedCode ? 'Copied!' : 'Copy Script Code'}
                    </button>
                  </div>
                  <pre className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-[11px] font-mono text-emerald-400 overflow-x-auto max-h-48 leading-relaxed">
                    {sampleAppsScriptCode}
                  </pre>
                </div>
              </div>

              <div className="flex gap-3 items-start">
                <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-300 font-black flex items-center justify-center shrink-0 border border-emerald-500/40">3</span>
                <div>
                  <h4 className="font-bold text-white text-xs">Deploy as Web App</h4>
                  <p className="text-slate-400 leading-relaxed">
                    Click <strong>Deploy &gt; New deployment</strong>. Select type <strong>Web App</strong>. Set <em>Who has access</em> to <strong>"Anyone"</strong>, then click <strong>Deploy</strong>. Copy the resulting Web App URL and paste it into the HRIS box below!
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
              <input
                type="text"
                placeholder="Paste your Web App URL here..."
                value={appsScriptUrlInput}
                onChange={(e) => setAppsScriptUrlInput(e.target.value)}
                className="flex-1 px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 font-mono"
              />
              <button
                onClick={() => {
                  handleSaveAppsScriptUrl();
                  setShowScriptModal(false);
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs"
              >
                Save & Start Live Sync
              </button>
            </div>
          </div>
        </div>
      )}

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
